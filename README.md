# Wildfire/Flood Insurance Appeal Agent

An agent that helps homeowners fight wrongful insurance non-renewals or premium hikes justified by wildfire or flood risk.

Insurers often flag properties using coarse, ZIP-code-level risk models. This agent pulls parcel-level, cited federal data via [Mireye](https://docs.mireye.ai), cross-references it against real wildfire perimeter history and insurer rate-filing rationale, detects mismatches, and drafts a formal appeal letter with every claim tied to a source and timestamp.

Built for the Mireye Build Challenge.

## The loop

1. **Input** — an address, or a pasted non-renewal/premium notice (address + stated reason extracted from it)
2. **Geocode** — resolve to canonical coordinates via Mireye
3. **Fetch physical facts** — `wildfire_underwrite` / `flood_risk` field presets for the parcel, cited and timestamped
4. **Fetch second source** — wildfire perimeter history (NIFC / CAL FIRE) near the parcel
5. **Reconcile** — compare the insurer's claim against what the cited parcel-level data actually shows
6. **Act** — on a real mismatch, generate a structured, source-cited appeal letter ready to file with the insurer or state DOI

## Status

Spec written, implementation not yet started. See [PROJECT.md](PROJECT.md) for the full build spec, data sources, demo scope, and build order.
