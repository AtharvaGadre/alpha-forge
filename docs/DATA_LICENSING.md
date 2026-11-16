# Data sources and licences

What Astraeus uses, under which terms, and what has to change before any commercial deployment. Checked against each provider's own terms page on 16 November 2026. This is an engineering summary, not legal advice; confirm with counsel before launching a paid or ad-supported service.

## Summary

| Source | Used for | Licence / terms | Commercial use | Attribution |
|---|---|---|---|---|
| Open-Meteo APIs (forecast, previous runs, ensemble, archive, geocoding) | All weather inputs | Data CC BY 4.0; **free API for non-commercial use only** (< 10,000 calls/day, 5,000/hour, 600/minute per IP) | Requires a paid API subscription | "Weather data by Open-Meteo.com" with a link next to wherever the data are shown |
| ECMWF IFS and AIFS open data (via Open-Meteo) | 2 of the 7 models | CC BY 4.0 | Allowed | Credit ECMWF, note modification |
| NOAA NCEP GFS (via Open-Meteo); NWS | 1 model, globe wind layer | US public domain ("may be used without charge for any lawful purpose") | Allowed | Must not imply NOAA endorsement or present modified data as official |
| DWD ICON (via Open-Meteo) | 1 model | CC BY 4.0 | Allowed | Credit Deutscher Wetterdienst |
| UK Met Office (via Open-Meteo) | 1 model | **CC BY-SA 4.0** | Allowed, but share-alike: published material adapted from it (our calibrated multi-model outlook) must carry CC BY-SA 4.0 | Credit Met Office, licence derived outputs CC BY-SA |
| JMA (via Open-Meteo) | 1 model | JMA Public Data License 1.0, compatible with CC BY 4.0 | Allowed | Credit Japan Meteorological Agency |
| ECCC / CMC GEM (via Open-Meteo) | 1 model | ECCC Data Servers End-use Licence v2.1 | Allowed | "Data Source: Environment and Climate Change Canada" |
| Copernicus ERA5 (via Open-Meteo) | Verification truth, training targets, climatology | Copernicus / CC BY 4.0 (ERA5) | Allowed | "Contains modified Copernicus Climate Change Service information [year]" |
| NASA POWER | Long-run regional climatology | NASA open data, no listed restrictions | Allowed | Cite POWER project and data version/date; project asks to be told of publications |
| Yahoo Finance chart endpoint (`query1.finance.yahoo.com`) | Futures prices (live panel, price study) | Undocumented endpoint; Yahoo's developer terms bar deriving income from Yahoo APIs without written permission | **Not allowed** without permission | — |
| US EIA | Natural-gas storage (fundamentals study) | US public domain | Allowed | "Source: U.S. Energy Information Administration (date)" |
| NOAA GHCN-Daily | Station verification | NOAA open data | Allowed (check non-US station notes) | Cite Menne et al. (2012), DOI 10.7289/V5D21VHZ, with access date |
| Natural Earth via `world-atlas` | Coastlines and land | Public domain (package ISC) | Allowed | Courtesy credit |
| Google Fonts: Cormorant Garamond, Plus Jakarta Sans, IBM Plex Mono | Typography | SIL Open Font License | Allowed | None in the UI |

## Before a commercial launch

1. **Open-Meteo:** buy an API subscription and set `OPEN_METEO_API_KEY` so the server uses the customer endpoints. Every weather request (live analyses, the globe layer, the daily precompute) is made server-side through `server/outbound.ts`, so the key applies to all of them.
2. **Prices:** replace the Yahoo chart endpoint with a licensed end-of-day futures feed. Exchange data, such as CME settlements, carry their own redistribution fees.
3. **Met Office share-alike:** either publish the calibrated outlook under CC BY-SA 4.0, or drop the UKMO member from commercial outputs and re-verify skill without it.
4. **Attribution:** keep the in-app attribution block (`src/components/DataAttribution.tsx`: Open-Meteo link, the seven model providers, the ERA5 notice, NASA POWER, the price disclaimer) visible wherever forecasts are displayed. It sits in the footer of every workspace view, at the sidebar foot (Open-Meteo credit), in the landing footer and in the printed technical report.

## Sources checked

- Open-Meteo terms: https://open-meteo.com/en/terms
- Open-Meteo licence and per-provider licences: https://open-meteo.com/en/licence
- NWS disclaimer (public domain): https://www.weather.gov/disclaimer
- JMA copyright and terms: https://www.jma.go.jp/jma/en/copyright.html
- ECCC Data Servers End-use Licence: https://eccc-msc.github.io/open-data/licence/readme_en
- Copernicus / ERA5 licence: https://apps.ecmwf.int/datasets/licences/copernicus/
- NASA POWER referencing: https://power.larc.nasa.gov/docs/referencing/
- EIA copyright and reuse: https://www.eia.gov/about/copyrights_reuse.php
- GHCN-Daily readme and citation: https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt
- Yahoo developer API terms: https://legal.yahoo.com/us/en/yahoo/terms/product-atos/apiforydn/index.html

## The repository's own licence

None has been chosen yet: no `LICENSE` file exists. Pick one before publishing the code. MIT or Apache-2.0 suit an open research release; keep it proprietary if the product will be sold. The published results files in `public/research/` inherit the share-alike condition above for anything derived from Met Office data.
