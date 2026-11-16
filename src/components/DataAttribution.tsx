import React from 'react';

/**
 * Data attribution shown wherever forecasts are displayed (workspace footer, landing footer).
 * Wording follows docs/DATA_LICENSING.md: the Open-Meteo credit with a link, the seven model
 * providers, the Copernicus ERA5 notice, NASA POWER, and the status of the market prices.
 */
const ext = { target: '_blank', rel: 'noreferrer' } as const;
const A = ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href} {...ext}>{children}</a>;

export function DataAttribution({ id, className = '' }: { id?: string; className?: string }) {
  const year = new Date().getUTCFullYear();
  return <section id={id} className={`as-attribution ${className}`.trim()} aria-labelledby={id ? `${id}-title` : undefined}>
    <h2 id={id ? `${id}-title` : undefined}>Data sources &amp; attribution</h2>
    <p><strong><A href="https://open-meteo.com/">Weather data by Open-Meteo.com</A></strong> (<A href="https://open-meteo.com/en/licence">CC BY 4.0</A>): forecasts, previous model runs, ensembles and reanalysis.</p>
    <p>Models: <A href="https://www.ecmwf.int/en/forecasts/datasets/open-data">ECMWF</A> IFS and AIFS · <A href="https://www.ncep.noaa.gov/">NOAA NCEP</A> GFS · <A href="https://www.dwd.de/">DWD</A> ICON · <A href="https://www.metoffice.gov.uk/">UK Met Office</A> (CC BY-SA 4.0) · <A href="https://www.jma.go.jp/">JMA</A> · <A href="https://eccc-msc.github.io/open-data/licence/readme_en">ECCC/CMC</A> GEM (Data Source: Environment and Climate Change Canada). Outputs are calibrated, i.e. modified; no provider endorses Astraeus.</p>
    <p>Contains modified <A href="https://climate.copernicus.eu/">Copernicus Climate Change Service</A> information {year} (ERA5). Long-run climatology from the <A href="https://power.larc.nasa.gov/">NASA Langley Research Center POWER Project</A>. Coastlines: <A href="https://www.naturalearthdata.com/">Natural Earth</A>.</p>
    <p>Prices are indicative, from <A href="https://finance.yahoo.com/">Yahoo Finance</A>, may be delayed or incomplete, and are <strong>not for trading</strong>.</p>
  </section>;
}
