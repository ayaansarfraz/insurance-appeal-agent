/**
 * The reconciliation agent: a Claude tool-calling loop.
 *
 * OWNER: Agent A. Server side only.
 *
 * This is the product. Everything else is plumbing that gets data to it or
 * formats what comes out.
 *
 * It is a loop rather than a fixed script because the agent chooses its own
 * evidence: given "high wildfire risk zone" it should request the six
 * wildfire_underwrite fields and not the thirteen flood_risk ones. That is what
 * makes it agentic, and since Mireye bills per field per parcel it is also the
 * cost control.
 *
 * A manual loop rather than the SDK tool runner: the loop is short enough to
 * read in one screen, and keeping it explicit means the preset choice the agent
 * made is observable in the returned toolCalls rather than buried in a helper.
 *
 * The agent's output is not trusted on the way out. lib/citation-guard.ts
 * checks every claim's citation against the sources actually fetched before any
 * of it reaches a letter.
 */

import Anthropic from '@anthropic-ai/sdk';

import { RECONCILIATION_SYSTEM_PROMPT } from './agent-prompt';
import { firesWithinRadius, nearestFirePerimeter } from './fire-data';
import { FIRE_PERIMETER_SOURCE } from './fire-source';
import { fetchParcelFields, geocode, type MireyePreset } from './mireye';
import type { FireHistoryCheck, ParcelFacts, ReconciliationResult } from './types';

const MODEL = 'claude-opus-5';

/** Bounds a pathological loop. Ample: a normal run is geocode, one or two
 *  fetches, one or two fire lookups, then submit. */
const MAX_TURNS = 12;

export interface AgentRun {
  parcel: ParcelFacts;
  fireHistory: FireHistoryCheck | null;
  reconciliation: ReconciliationResult;
  /** Which presets the agent decided to fetch. Surfaced because "the agent
   *  chose its evidence" is a claim this project makes, and this is the
   *  evidence for it. */
  presetsChosen: MireyePreset[];
  /** Ordered tool names, for showing the agent's actual path. */
  toolCalls: string[];
  unavailableFields: string[];
}

const tools: Anthropic.Tool[] = [
  {
    name: 'mireye_geocode',
    description:
      'Resolve a street address to parcel coordinates. Call this first: the other tools need coordinates. Returns the normalized address and how the match was derived.',
    input_schema: {
      type: 'object',
      properties: { address: { type: 'string', description: 'Street address to resolve.' } },
      required: ['address'],
    },
  },
  {
    name: 'mireye_fetch_fields',
    description:
      'Fetch cited parcel level measurements for one or more field presets. Billed per field per parcel, so request only presets that bear on the insurer stated reason. Each field comes back with the exact source string you must cite.',
    input_schema: {
      type: 'object',
      properties: {
        presets: {
          type: 'array',
          items: { type: 'string', enum: ['wildfire_underwrite', 'flood_risk', 'natural_hazard'] },
          description: 'Presets to fetch.',
        },
      },
      required: ['presets'],
    },
  },
  {
    name: 'fire_perimeter_history',
    description:
      'Nearest recorded wildfire perimeter to the parcel, from CAL FIRE records covering California 2006 to 2025. Returns 0 miles when the parcel sits inside a burn scar, and null when nothing is within the search radius, which is itself evidence.',
    input_schema: {
      type: 'object',
      properties: {
        radius_miles: { type: 'number', description: 'Search radius, default 25.' },
      },
      required: [],
    },
  },
  {
    name: 'fires_within_radius',
    description:
      'Every recorded fire whose perimeter falls within a radius, most recent first, with acreage, distance and ignition date. Use this to judge severity and recency rather than counting perimeters, and use alarmDate rather than the year when the insurer stated a time window.',
    input_schema: {
      type: 'object',
      properties: {
        radius_miles: { type: 'number', description: 'Search radius in miles, e.g. 5.' },
      },
      required: ['radius_miles'],
    },
  },
  {
    name: 'submit_reconciliation',
    description:
      'Submit the final assessment. Call once, when you have gathered enough evidence. This ends your turn.',
    input_schema: {
      type: 'object',
      properties: {
        mismatchFound: {
          type: 'boolean',
          description:
            'True when the insurer stated reason is not supported for this parcel. False when it holds up.',
        },
        explanation: {
          type: 'string',
          description:
            'Short plain language paragraph for the homeowner explaining the conclusion. No em dashes.',
        },
        supportingFacts: {
          type: 'array',
          description: 'The specific sourced findings the conclusion rests on.',
          items: {
            type: 'object',
            properties: {
              claim: { type: 'string', description: 'One factual statement.' },
              source: {
                type: 'string',
                description:
                  'The exact source string from the tool result, character for character.',
              },
              fetchedAt: { type: 'string', description: 'The fetchedAt from the tool result.' },
            },
            required: ['claim', 'source', 'fetchedAt'],
          },
        },
      },
      required: ['mismatchFound', 'explanation', 'supportingFacts'],
    },
  },
];

/** Trims a fire list before it goes into context. The full list for a Los
 *  Angeles parcel runs to dozens of entries and the tail is not load bearing. */
function summarizeFires(
  fires: Array<{
    name: string;
    year: number;
    distanceMiles: number;
    acres: number | null;
    alarmDate: string | null;
  }>,
) {
  const sorted = [...fires].sort((a, b) => (b.acres ?? 0) - (a.acres ?? 0));
  return {
    count: fires.length,
    largestByAcreage: sorted.slice(0, 6),
    mostRecent: fires.slice(0, 6),
    source: FIRE_PERIMETER_SOURCE.source,
    fetchedAt: FIRE_PERIMETER_SOURCE.fetchedAt,
  };
}

export async function runAppealAgent(
  address: string,
  insurerStatedReason: string,
): Promise<AgentRun> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local.');
  }
  const client = new Anthropic();

  // Accumulated as the agent works. The route needs these for the citation
  // guard and the UI regardless of what the agent concludes.
  let coordinates: { lat: number; lng: number } | null = null;
  let parcel: ParcelFacts = {
    address,
    coordinates: { lat: 0, lng: 0 },
    wildfireFields: {},
    floodFields: {},
  };
  let fireHistory: FireHistoryCheck | null = null;
  let unavailableFields: string[] = [];
  const presetsChosen: MireyePreset[] = [];
  const toolCalls: string[] = [];
  let reconciliation: ReconciliationResult | null = null;

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Today's date: ${new Date().toISOString().slice(0, 10)}\n\nProperty address: ${address}\n\nThe insurer's stated reason:\n"${insurerStatedReason}"\n\nAssess whether that reason holds up for this specific parcel.`,
    },
  ];

  async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'mireye_geocode': {
        const geo = await geocode(String(input.address ?? address));
        coordinates = { lat: geo.lat, lng: geo.lng };
        parcel = { ...parcel, address: geo.normalizedAddress ?? address, coordinates };
        return geo;
      }
      case 'mireye_fetch_fields': {
        if (!coordinates) return { error: 'Call mireye_geocode first.' };
        const presets = (input.presets as MireyePreset[]) ?? [];
        if (presets.length === 0) return { error: 'Specify at least one preset.' };
        presetsChosen.push(...presets.filter((p) => !presetsChosen.includes(p)));
        const result = await fetchParcelFields(parcel.address, coordinates, presets);
        // Merge rather than replace: the agent may fetch presets across
        // separate calls and the later one must not discard the earlier facts.
        parcel = {
          ...result.parcel,
          wildfireFields: { ...parcel.wildfireFields, ...result.parcel.wildfireFields },
          floodFields: { ...parcel.floodFields, ...result.parcel.floodFields },
        };
        unavailableFields = Array.from(
          new Set([...unavailableFields, ...result.unavailableFields]),
        );
        return { fields: result.parcel, unavailableFields: result.unavailableFields };
      }
      case 'fire_perimeter_history': {
        if (!coordinates) return { error: 'Call mireye_geocode first.' };
        fireHistory = await nearestFirePerimeter(
          coordinates,
          typeof input.radius_miles === 'number' ? input.radius_miles : undefined,
        );
        return (
          fireHistory ?? {
            result: 'No recorded perimeter within the search radius.',
            source: FIRE_PERIMETER_SOURCE.source,
            fetchedAt: FIRE_PERIMETER_SOURCE.fetchedAt,
          }
        );
      }
      case 'fires_within_radius': {
        if (!coordinates) return { error: 'Call mireye_geocode first.' };
        const radius = typeof input.radius_miles === 'number' ? input.radius_miles : 5;
        return summarizeFires(await firesWithinRadius(coordinates, radius));
      }
      default:
        return { error: `Unknown tool ${name}` };
    }
  }

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system: RECONCILIATION_SYSTEM_PROMPT,
      tools,
      messages,
    });

    // Append the whole content block array, not just the text: thinking blocks
    // must be passed back unchanged on the same model, and dropping the
    // tool_use blocks would break the pairing with their results.
    messages.push({ role: 'assistant', content: response.content });

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    if (toolUses.length === 0) {
      // The model stopped without submitting. Ask once, explicitly.
      if (response.stop_reason === 'end_turn' && !reconciliation) {
        messages.push({
          role: 'user',
          content:
            'You have not submitted an assessment yet. Call submit_reconciliation with your conclusion.',
        });
        continue;
      }
      break;
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      toolCalls.push(use.name);

      if (use.name === 'submit_reconciliation') {
        const input = use.input as Omit<ReconciliationResult, 'insurerStatedReason'>;
        reconciliation = {
          insurerStatedReason,
          mismatchFound: Boolean(input.mismatchFound),
          explanation: String(input.explanation ?? ''),
          supportingFacts: Array.isArray(input.supportingFacts) ? input.supportingFacts : [],
        };
        results.push({ type: 'tool_result', tool_use_id: use.id, content: 'Recorded.' });
        continue;
      }

      try {
        const output = await runTool(use.name, (use.input ?? {}) as Record<string, unknown>);
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(output),
        });
      } catch (err) {
        // Returned to the model rather than thrown: a failed lookup is
        // something it should reason about and say it could not verify, not a
        // crash that loses the whole assessment.
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: `Tool failed: ${err instanceof Error ? err.message : String(err)}`,
          is_error: true,
        });
      }
    }

    if (reconciliation) break;
    messages.push({ role: 'user', content: results });
  }

  if (!reconciliation) {
    throw new Error(
      `The reconciliation agent finished without submitting an assessment after ${MAX_TURNS} turns.`,
    );
  }

  return {
    parcel,
    fireHistory,
    reconciliation,
    presetsChosen,
    toolCalls,
    unavailableFields,
  };
}
