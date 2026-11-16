/**
 * Research library: the cited evidence behind Astraeus weather-layer and
 * commodity-signal claims.
 *
 * How each record was checked (2026-11-15):
 *  - Bibliographic metadata (authors, year, title, venue, volume, pages, DOI) was
 *    confirmed against the Crossref REST API (api.crossref.org/works/<doi>). arXiv,
 *    AgEcon Search and Zenodo DOIs, which are registered with DataCite, were checked
 *    through api.datacite.org instead.
 *  - `finding` is an editorial paraphrase of the retrieved abstract, full text or
 *    official page. Numbers are copied from that source; none are estimated here.
 *  - `verified: true` means both the metadata AND the finding were checked against
 *    a retrieved primary source (or, where stated in the finding, the authors'
 *    working-paper version). `verified: false` means at least one part rests on
 *    secondary descriptions only; the finding says which part.
 *  - A reference without a `doi` has none (e.g. AER 1984, FAO-56, ECMWF memoranda).
 *    Do not invent one.
 *
 * Tone and scope follow commodityPapers.ts. Evidence that weather moves yields
 * or prices is not a trading coefficient for Astraeus. Published skill scores are
 * context, not Astraeus's own verification results.
 */

export interface ResearchReference {
  id: string;
  authors: string;
  year: number;
  title: string;
  venue: string;
  doi?: string;
  url: string;
  topic:
    | 'postprocessing'
    | 'verification'
    | 'ml-weather'
    | 'reanalysis'
    | 'weather-commodity'
    | 'econometrics'
    | 'visualisation';
  finding: string;
  usedFor: string;
  verified: boolean;
}

export interface SkillContextEntry {
  claim: string;
  value: string;
  source: string;
  url: string;
  verified: boolean;
}

export const RESEARCH_LIBRARY_REVIEWED_AT = '2026-11-15';

export const RESEARCH_LIBRARY: ResearchReference[] = [
  // ───────────────────────────── Post-processing ─────────────────────────────
  {
    id: 'gneiting2005-emos',
    authors: 'Tilmann Gneiting, Adrian E. Raftery, Anton H. Westveld, Tom Goldman',
    year: 2005,
    title: 'Calibrated Probabilistic Forecasting Using Ensemble Model Output Statistics and Minimum CRPS Estimation',
    venue: 'Monthly Weather Review, 133(5), 1098–1118',
    doi: '10.1175/MWR2904.1',
    url: 'https://doi.org/10.1175/MWR2904.1',
    topic: 'postprocessing',
    finding:
      'Introduces EMOS: a Gaussian predictive distribution whose mean is a bias-corrected weighted average of the member forecasts and whose variance is a linear function of the ensemble variance, with coefficients fitted by minimum-CRPS estimation. For 48-h sea-level pressure forecasts from the University of Washington mesoscale ensemble, the EMOS point forecasts had 9% lower RMSE and 7% lower MAE than the bias-corrected ensemble, and the predictive PDFs were sharp and much better calibrated.',
    usedFor:
      'Primary citation for the EMOS/NGR calibration layer: the weighted-mean and linear-variance model and minimum-CRPS fitting. The 9%/7% gains come from one regional mesoscale case study and are not an expected Astraeus improvement.',
    verified: true,
  },
  {
    id: 'raftery2005-bma',
    authors: 'Adrian E. Raftery, Tilmann Gneiting, Fadoua Balabdaoui, Michael Polakowski',
    year: 2005,
    title: 'Using Bayesian Model Averaging to Calibrate Forecast Ensembles',
    venue: 'Monthly Weather Review, 133(5), 1155–1174',
    doi: '10.1175/MWR2906.1',
    url: 'https://doi.org/10.1175/MWR2906.1',
    topic: 'postprocessing',
    finding:
      'BMA forms the predictive PDF as a weighted mixture of PDFs centred on bias-corrected member forecasts, with weights equal to posterior model probabilities. Its predictive variance splits into between-forecast and within-forecast parts, which explains why spread-only intervals are underdispersive. For 48-h surface temperature in the Pacific Northwest, 90% BMA intervals were 66% shorter on average than those from sample climatology. The BMA point forecast had 7% lower RMSE than the best member and 8% lower than the ensemble mean.',
    usedFor:
      'Benchmark and alternative for combining the seven NWP models. Supports showing calibrated uncertainty separately from raw inter-model spread.',
    verified: true,
  },
  {
    id: 'krishnamurti1999-superensemble',
    authors: 'T. N. Krishnamurti, C. M. Kishtawal, Timothy E. LaRow, David R. Bachiochi et al.',
    year: 1999,
    title: 'Improved Weather and Seasonal Climate Forecasts from Multimodel Superensemble',
    venue: 'Science, 285(5433), 1548–1550',
    doi: '10.1126/science.285.5433.1548',
    url: 'https://doi.org/10.1126/science.285.5433.1548',
    topic: 'postprocessing',
    finding:
      'Coefficients fitted by multiple regression of observations on multimodel forecasts (the superensemble) outperformed every member model for multiseasonal, medium-range and hurricane forecasts. They also beat forecasts based only on ensemble averaging.',
    usedFor:
      'Precedent for skill-weighted rather than equal-weighted combination of the seven global models. Regression weights need enough training data to avoid overfitting.',
    verified: true,
  },
  {
    id: 'cui2012-naefs-bias',
    authors: 'Bo Cui, Zoltan Toth, Yuejian Zhu, Dingchen Hou',
    year: 2012,
    title: 'Bias Correction for Global Ensemble Forecast',
    venue: 'Weather and Forecasting, 27(2), 396–410',
    doi: '10.1175/WAF-D-11-00011.1',
    url: 'https://doi.org/10.1175/WAF-D-11-00011.1',
    topic: 'postprocessing',
    finding:
      'Describes the Kalman-filter-type decaying-average bias correction that NCEP implemented in 2006 for the NCEP and MSC ensembles before they are merged into NAEFS. The decaying-average method worked well for the first few days and improved the probabilistic performance of the NCEP ensemble on all measures until day 5. A reforecast-based climate-mean bias correction added value, especially for week-2 probabilities.',
    usedFor:
      'Citation for the running (exponentially decaying) per-model, per-lead-time bias correction applied before EMOS. Benefit is documented mainly for early lead times.',
    verified: true,
  },
  {
    id: 'scheuerer2015-csgd',
    authors: 'Michael Scheuerer, Thomas M. Hamill',
    year: 2015,
    title: 'Statistical Postprocessing of Ensemble Precipitation Forecasts by Fitting Censored, Shifted Gamma Distributions',
    venue: 'Monthly Weather Review, 143(11), 4578–4596',
    doi: '10.1175/MWR-D-15-0061.1',
    url: 'https://doi.org/10.1175/MWR-D-15-0061.1',
    topic: 'postprocessing',
    finding:
      'Censored, shifted gamma distributions approximate the conditional distribution of observed precipitation given GEFS ensemble forecasts well (12 years of reforecasts, 1/8° analyses). The resulting forecasts were reliable, highly skilful and sharper than an analog method. The paper gives a closed-form CRPS for this distribution, which makes model fitting by numerical CRPS minimisation computationally efficient (checked in full text). Skill depends on a sufficiently large training dataset.',
    usedFor:
      'Precipitation predictive distribution (point mass at zero plus skewed positive tail) and its closed-form CRPS. Supports the warning that short training windows limit parametric post-processing.',
    verified: true,
  },
  {
    id: 'messner2014-helr',
    authors: 'Jakob W. Messner, Georg J. Mayr, Achim Zeileis, Daniel S. Wilks',
    year: 2014,
    title: 'Heteroscedastic Extended Logistic Regression for Postprocessing of Ensemble Guidance',
    venue: 'Monthly Weather Review, 142(1), 448–456',
    doi: '10.1175/MWR-D-13-00271.1',
    url: 'https://doi.org/10.1175/MWR-D-13-00271.1',
    topic: 'postprocessing',
    finding:
      'When ensemble spread enters extended logistic regression only as an ordinary predictor, it shifts the location but not the variance of the predictive distribution. Using spread to predict the dispersion directly lets it improve ECMWF wind-speed forecasts.',
    usedFor:
      'Supports modelling the predictive scale from inter-model spread (heteroscedastic regression) rather than adding spread as a mean predictor.',
    verified: true,
  },
  {
    id: 'messner2014-censored-logistic',
    authors: 'Jakob W. Messner, Georg J. Mayr, Daniel S. Wilks, Achim Zeileis',
    year: 2014,
    title: 'Extending Extended Logistic Regression: Extended versus Separate versus Ordered versus Censored',
    venue: 'Monthly Weather Review, 142(8), 3003–3014',
    doi: '10.1175/MWR-D-13-00355.1',
    url: 'https://doi.org/10.1175/MWR-D-13-00355.1',
    topic: 'postprocessing',
    finding:
      'Compares extended, separate, ordered and censored logistic regression on wind-speed and precipitation data from several European locations with ECMWF ensembles. Ordered logistic regression matched extended logistic regression for category probabilities, but censored regression predicted full predictive distributions better.',
    usedFor:
      'Primary citation for censored (logistic) regression of precipitation with censoring at zero. This is the MWR paper that compares censored logistic regression; the heteroscedastic variant is messner2014-helr, and the software is messner2016-crch.',
    verified: true,
  },
  {
    id: 'messner2016-crch',
    authors: 'Jakob W. Messner, Georg J. Mayr, Achim Zeileis',
    year: 2016,
    title: 'Heteroscedastic Censored and Truncated Regression with crch',
    venue: 'The R Journal, 8(1), 173 (start page per Crossref)',
    doi: '10.32614/RJ-2016-012',
    url: 'https://doi.org/10.32614/RJ-2016-012',
    topic: 'postprocessing',
    finding:
      'The crch R package fits censored or truncated regression models with conditional heteroscedasticity by maximum likelihood. It supports Gaussian, logistic or Student-t distributions with separate regressors for location and scale, illustrated with precipitation forecasting for Innsbruck.',
    usedFor:
      'Reference implementation for cross-checking the heteroscedastic censored precipitation regression.',
    verified: true,
  },
  {
    id: 'thorarinsdottir2010-censored-emos',
    authors: 'Thordis L. Thorarinsdottir, Tilmann Gneiting',
    year: 2010,
    title: 'Probabilistic Forecasts of Wind Speed: Ensemble Model Output Statistics by using Heteroscedastic Censored Regression',
    venue: 'Journal of the Royal Statistical Society Series A, 173(2), 371–388',
    doi: '10.1111/j.1467-985x.2009.00616.x',
    url: 'https://doi.org/10.1111/j.1467-985x.2009.00616.x',
    topic: 'postprocessing',
    finding:
      'Heteroscedastic censored (tobit) regression EMOS, with location and spread derived from the ensemble, produced calibrated and sharp 48-h maximum wind-speed forecasts for the Pacific Northwest. It substantially improved on the raw ensemble and on climatological reference forecasts.',
    usedFor:
      'Precedent for censored-normal EMOS on non-negative variables (wind speed, and by extension precipitation).',
    verified: true,
  },
  {
    id: 'baran2016-csg-emos',
    authors: 'Sándor Baran, Dóra Nemoda',
    year: 2016,
    title: 'Censored and shifted gamma distribution based EMOS model for probabilistic quantitative precipitation forecasting',
    venue: 'Environmetrics, 27(5), 280–292',
    doi: '10.1002/env.2391',
    url: 'https://doi.org/10.1002/env.2391',
    topic: 'postprocessing',
    finding:
      'An EMOS model with a censored, shifted gamma predictive law for 24-h precipitation was tested on the eight-member University of Washington mesoscale ensemble and the 11-member operational limited-area ensemble of the Hungarian Meteorological Service. It slightly outperformed GEV-based EMOS in calibration and point accuracy, and was significantly better than the raw ensemble and gamma BMA.',
    usedFor:
      'Second independent source for censored-shifted-gamma EMOS of precipitation.',
    verified: true,
  },
  {
    id: 'gebetsberger2018-crps-vs-ml',
    authors: 'Manuel Gebetsberger, Jakob W. Messner, Georg J. Mayr, Achim Zeileis',
    year: 2018,
    title: 'Estimation Methods for Nonhomogeneous Regression Models: Minimum Continuous Ranked Probability Score versus Maximum Likelihood',
    venue: 'Monthly Weather Review, 146(12), 4323–4338',
    doi: '10.1175/MWR-D-17-0364.1',
    url: 'https://doi.org/10.1175/MWR-D-17-0364.1',
    topic: 'postprocessing',
    finding:
      'Both estimators are consistent under a correct distributional assumption, so different estimates signal model misspecification. For temperature, the Gaussian NGR showed discrepancies between the two. Heavy-tailed logistic and Student-t distributions improved sharpness and calibration and left only minor differences. Simulations showed maximum likelihood slightly more efficient when the model is correctly specified.',
    usedFor:
      'Justifies the estimator choice and a diagnostic: compare min-CRPS and ML fits, and treat large gaps as a sign the predictive family is wrong.',
    verified: true,
  },
  {
    id: 'lerch2017-semilocal',
    authors: 'Sebastian Lerch, Sándor Baran',
    year: 2017,
    title: 'Similarity-Based Semilocal Estimation of Post-Processing Models',
    venue: 'Journal of the Royal Statistical Society Series C (Applied Statistics), 66(1), 29–51',
    doi: '10.1111/rssc.12153',
    url: 'https://doi.org/10.1111/rssc.12153',
    topic: 'postprocessing',
    finding:
      'Augments each station’s EMOS training data with forecast cases from stations with similar characteristics, found by distance functions or by clustering on climatology, forecast errors and location. In a wind-speed case study over Europe (Grand Limited Area Model Ensemble Prediction System, GLAMEPS) this significantly improved on standard regional and local estimation, avoided numerical-stability problems and was computationally cheaper than local estimation.',
    usedFor:
      'Pooling training samples across similar grid cells when local histories are short. Note: published in JRSS Series C, not Monthly Weather Review.',
    verified: true,
  },
  {
    id: 'rasp2018-nn-postprocessing',
    authors: 'Stephan Rasp, Sebastian Lerch',
    year: 2018,
    title: 'Neural Networks for Postprocessing Ensemble Weather Forecasts',
    venue: 'Monthly Weather Review, 146(11), 3885–3900',
    doi: '10.1175/MWR-D-18-0187.1',
    url: 'https://doi.org/10.1175/MWR-D-18-0187.1',
    topic: 'postprocessing',
    finding:
      'A neural network that outputs distribution parameters significantly outperformed benchmark post-processing methods for 2-m temperature at German surface stations, at lower computational cost. Auxiliary predictors and station embeddings were key to the improvement.',
    usedFor:
      'Upgrade path beyond linear EMOS once enough station or grid history exists. Not a claim about current Astraeus skill.',
    verified: true,
  },
  {
    id: 'vannitsem2021-review',
    authors: 'Stéphane Vannitsem, John Bjørnar Bremnes, Jonathan Demaeyer, Gavin R. Evans et al.',
    year: 2021,
    title: 'Statistical Postprocessing for Weather Forecasts: Review, Challenges, and Avenues in a Big Data World',
    venue: 'Bulletin of the American Meteorological Society, 102(3), E681–E699',
    doi: '10.1175/BAMS-D-19-0308.1',
    url: 'https://doi.org/10.1175/BAMS-D-19-0308.1',
    topic: 'postprocessing',
    finding:
      'Reviews methods from simple bias correction to multivariate distribution-adjusting techniques. Open challenges include kilometre-scale ensembles, preserving space–time correlation in corrected fields, model upgrades that change correction parameters, merging forecasts from systems with different behaviour, and moving research into operations.',
    usedFor:
      'Survey citation for the methods section. Its warning about model upgrades applies directly to retraining after NWP cycle changes.',
    verified: true,
  },
  {
    id: 'hagedorn2012-tigge',
    authors: 'Renate Hagedorn, Roberto Buizza, Thomas M. Hamill, Martin Leutbecher, T. N. Palmer',
    year: 2012,
    title: 'Comparing TIGGE multimodel forecasts with reforecast-calibrated ECMWF ensemble forecasts',
    venue: 'Quarterly Journal of the Royal Meteorological Society, 138(668), 1814–1827',
    doi: '10.1002/qj.1895',
    url: 'https://doi.org/10.1002/qj.1895',
    topic: 'postprocessing',
    finding:
      'For 850-hPa and 2-m temperature, a nine-system TIGGE multimodel did not improve on the ECMWF EPS alone. A four-system multimodel (Canada, USA, UK, ECMWF) did. Reforecast-calibrated ECMWF EPS forecasts were of comparable or superior quality to the multimodel, and without the ECMWF member the multimodel could not beat ECMWF alone.',
    usedFor:
      'Caution for the seven-model blend: adding weak models can dilute skill, so weights must reflect verified skill, and a well-calibrated single model is a required benchmark.',
    verified: true,
  },

  // ─────────────────────────────── Verification ───────────────────────────────
  {
    id: 'gneiting2007-scoring-rules',
    authors: 'Tilmann Gneiting, Adrian E. Raftery',
    year: 2007,
    title: 'Strictly Proper Scoring Rules, Prediction, and Estimation',
    venue: 'Journal of the American Statistical Association, 102(477), 359–378',
    doi: '10.1198/016214506000001437',
    url: 'https://doi.org/10.1198/016214506000001437',
    topic: 'verification',
    finding:
      'Develops the theory of proper scoring rules. The CRPS applies to forecasts given as predictive CDFs, generalises the absolute error and is a special case of the energy score. The paper also proposes the interval score, which rewards narrow intervals and penalises missed coverage.',
    usedFor:
      'Justifies CRPS as the headline probabilistic score (same units as the variable, comparable with MAE) and the interval score for 90% prediction intervals.',
    verified: true,
  },
  {
    id: 'gneiting2007-calibration-sharpness',
    authors: 'Tilmann Gneiting, Fadoua Balabdaoui, Adrian E. Raftery',
    year: 2007,
    title: 'Probabilistic Forecasts, Calibration and Sharpness',
    venue: 'Journal of the Royal Statistical Society Series B, 69(2), 243–268',
    doi: '10.1111/j.1467-9868.2007.00587.x',
    url: 'https://doi.org/10.1111/j.1467-9868.2007.00587.x',
    topic: 'verification',
    finding:
      'Proposes evaluating probabilistic forecasts by maximising sharpness subject to calibration. Diagnostic tools include the PIT histogram, marginal calibration plots, the sharpness diagram and proper scoring rules.',
    usedFor:
      'Citation for PIT histograms, empirical interval coverage and showing interval width alongside coverage.',
    verified: true,
  },
  {
    id: 'hersbach2000-crps',
    authors: 'Hans Hersbach',
    year: 2000,
    title: 'Decomposition of the Continuous Ranked Probability Score for Ensemble Prediction Systems',
    venue: 'Weather and Forecasting, 15(5), 559–570',
    doi: '10.1175/1520-0434(2000)015<0559:DOTCRP>2.0.CO;2',
    url: 'https://doi.org/10.1175/1520-0434(2000)015%3C0559:DOTCRP%3E2.0.CO;2',
    topic: 'verification',
    finding:
      'For an ensemble, the CRPS decomposes into a reliability part, closely linked to the rank histogram, and a resolution/uncertainty part. The CRPS equals the integral of the Brier score over all thresholds and reduces to the mean absolute error for a deterministic forecast.',
    usedFor:
      'CRPS of the raw multi-model ensemble, and comparing deterministic MAE with probabilistic CRPS on one scale.',
    verified: true,
  },
  {
    id: 'ferro2014-fair-crps',
    authors: 'C. A. T. Ferro',
    year: 2014,
    title: 'Fair scores for ensemble forecasts',
    venue: 'Quarterly Journal of the Royal Meteorological Society, 140(683), 1917–1923',
    doi: '10.1002/qj.2270',
    url: 'https://doi.org/10.1002/qj.2270',
    topic: 'verification',
    finding: 'Defines “fair” versions of scoring rules, including the CRPS, that do not penalise an ensemble merely for having few members, so ensembles of different sizes can be compared with the distribution they are drawn from.',
    usedFor: 'Separating the finite-ensemble penalty of scoring 5–7 raw members from genuine skill gains in the Astraeus benchmark.',
    verified: true,
  },
  {
    id: 'hamill2001-rank-histograms',
    authors: 'Thomas M. Hamill',
    year: 2001,
    title: 'Interpretation of Rank Histograms for Verifying Ensemble Forecasts',
    venue: 'Monthly Weather Review, 129(3), 550–560',
    doi: '10.1175/1520-0493(2001)129<0550:IORHFV>2.0.CO;2',
    url: 'https://doi.org/10.1175/1520-0493(2001)129%3C0550:IORHFV%3E2.0.CO;2',
    topic: 'verification',
    finding:
      'A flat rank histogram can come from an unreliable ensemble, and a U-shape can indicate conditional bias as well as too little spread. Observation errors must be accounted for. Significance tests need samples spaced far enough apart in time and space to be independent.',
    usedFor:
      'Caveats shown next to rank and PIT histograms; supports thinning or block-bootstrapping before testing uniformity.',
    verified: true,
  },
  {
    id: 'jordan2019-scoringrules',
    authors: 'Alexander Jordan, Fabian Krüger, Sebastian Lerch',
    year: 2019,
    title: 'Evaluating Probabilistic Forecasts with scoringRules',
    venue: 'Journal of Statistical Software, 90(12)',
    doi: '10.18637/jss.v090.i12',
    url: 'https://doi.org/10.18637/jss.v090.i12',
    topic: 'verification',
    finding:
      'Describes the scoringRules R package for proper scoring rules on parametric and simulated forecast distributions, with case studies from meteorology and economics. The package NAMESPACE (v1.1.3) exports closed-form CRPS functions for censored normal, logistic and Student-t distributions (crps_cnorm, crps_clogis, crps_ct) and for generalised truncated/censored families (crps_gtcnorm, crps_gtclogis, crps_gtct). It has no censored-shifted-gamma CRPS.',
    usedFor:
      'Reference implementation for unit-testing the closed-form CRPS of censored Gaussian/logistic predictive distributions. For the CSGD, use the expression in scheuerer2015-csgd.',
    verified: true,
  },
  {
    id: 'haiden2026-ecmwf-tm938',
    authors: 'Thomas Haiden, Martin Janousek, Frederic Vitart, Michael Maier-Gerber, Cathy Wing Yi Li, Fernando Prates, Matthieu Chevallier',
    year: 2026,
    title: 'Evaluation of ECMWF forecasts',
    venue: 'ECMWF Technical Memorandum No. 938 (September 2026)',
    url: 'https://www.ecmwf.int/sites/default/files/elibrary/092026/81748-evaluation-of-ecmwf-forecasts.pdf',
    topic: 'verification',
    finding:
      'ECMWF still leads overall for upper-air variables, but other centres have partly taken the lead for surface variables, especially in the short range. The AIFS shows superior skill in most upper-air and surface parameters. The AIFS-Single headline curves sit ‘on the order of half a day of lead time above those of the IFS’. At an 86% ACC threshold, the AIFS leads the IFS by about one-third of a forecast day, similar to the IFS lead over other centres. IFS Cycle 50r1 and AIFS v2 were implemented on 12 May 2026.',
    usedFor:
      'Source for the headline-skill context in SKILL_CONTEXT. Supports the claim that IFS/AIFS lead on upper-air fields, and the caveat that surface skill is more mixed across centres.',
    verified: true,
  },
  {
    id: 'bauer2015-quiet-revolution',
    authors: 'Peter Bauer, Alan Thorpe, Gilbert Brunet',
    year: 2015,
    title: 'The quiet revolution of numerical weather prediction',
    venue: 'Nature, 525(7567), 47–55',
    doi: '10.1038/nature14956',
    url: 'https://doi.org/10.1038/nature14956',
    topic: 'verification',
    finding:
      'Review arguing that NWP has advanced through a steady accumulation of scientific and technological progress rather than single breakthroughs, and that its impact is among the greatest of any physical science. Only the abstract was checked. The widely quoted ‘about one day per decade’ skill gain is in the paywalled body and was not checked here.',
    usedFor:
      'Context citation for long-run NWP progress. For quantitative skill trends, cite ECMWF memoranda (see SKILL_CONTEXT) rather than a paraphrase of this paper.',
    verified: true,
  },

  // ──────────────────────────────── Reanalysis ────────────────────────────────
  {
    id: 'hersbach2020-era5',
    authors: 'Hans Hersbach, Bill Bell, Paul Berrisford, Shoji Hirahara et al.',
    year: 2020,
    title: 'The ERA5 global reanalysis',
    venue: 'Quarterly Journal of the Royal Meteorological Society, 146(730), 1999–2049',
    doi: '10.1002/qj.3803',
    url: 'https://doi.org/10.1002/qj.3803',
    topic: 'reanalysis',
    finding:
      'ERA5 is based on IFS Cy41r2 and has 31-km resolution (versus 80 km for ERA-Interim), hourly output and an ensemble uncertainty estimate. Re-forecasts from ERA5 analyses gain up to one day of skill over ERA-Interim. The global-mean correlation of precipitation with monthly GPCP data rises from 67% to 77%.',
    usedFor:
      'Verification reference for scoring the seven models. Caveat: ERA5 precipitation is model-derived, not observed, and correlates 77% (not 100%) with monthly GPCP, so station or gauge checks are still needed for rainfall.',
    verified: true,
  },

  // ───────────────────────────── ML weather models ─────────────────────────────
  {
    id: 'lam2023-graphcast',
    authors: 'Remi Lam, Alvaro Sanchez-Gonzalez, Matthew Willson, Peter Wirnsberger et al.',
    year: 2023,
    title: 'Learning skillful medium-range global weather forecasting',
    venue: 'Science, 382(6677), 1416–1421',
    doi: '10.1126/science.adi2336',
    url: 'https://doi.org/10.1126/science.adi2336',
    topic: 'ml-weather',
    finding:
      'GraphCast, trained on reanalysis, predicts hundreds of variables 10 days ahead at 0.25° globally in under a minute. It ‘significantly outperforms the most accurate operational deterministic systems on 90% of 1380 verification targets’ and improves severe-event prediction (tropical-cyclone tracks, atmospheric rivers, extreme temperatures).',
    usedFor:
      'Context for why ML models (e.g. AIFS) are credible ensemble members. The 90% figure is GraphCast vs HRES in the authors’ evaluation, not a property of Open-Meteo feeds.',
    verified: true,
  },
  {
    id: 'price2025-gencast',
    authors: 'Ilan Price, Alvaro Sanchez-Gonzalez, Ferran Alet, Tom R. Andersson et al.',
    year: 2025,
    title: 'Probabilistic weather forecasting with machine learning',
    venue: 'Nature, 637(8044), 84–90 (published online 4 December 2024)',
    doi: '10.1038/s41586-024-08252-9',
    url: 'https://doi.org/10.1038/s41586-024-08252-9',
    topic: 'ml-weather',
    finding:
      'GenCast produces stochastic 15-day global ensemble forecasts at 12-h steps and 0.25° for more than 80 variables in 8 minutes. It ‘has greater skill than ENS on 97.2% of 1,320 targets’ evaluated, and better predicts extreme weather, tropical-cyclone tracks and wind-power production.',
    usedFor:
      'Evidence that ML ensembles can match or beat physics ensembles probabilistically. Context only, since GenCast is not one of the seven ingested models.',
    verified: true,
  },
  {
    id: 'bi2023-pangu',
    authors: 'Kaifeng Bi, Lingxi Xie, Hengheng Zhang, Xin Chen, Xiaotao Gu, Qi Tian',
    year: 2023,
    title: 'Accurate medium-range global weather forecasting with 3D neural networks',
    venue: 'Nature, 619(7970), 533–538',
    doi: '10.1038/s41586-023-06185-3',
    url: 'https://doi.org/10.1038/s41586-023-06185-3',
    topic: 'ml-weather',
    finding:
      'Pangu-Weather, trained on 39 years of global data, obtained stronger deterministic results on reanalysis data in all tested variables than ECMWF’s operational IFS. Initialised from reanalysis, it also tracked tropical cyclones more accurately than ECMWF-HRES.',
    usedFor:
      'Historical context for ML weather models. Note that its comparison is against reanalysis-initialised runs.',
    verified: true,
  },
  {
    id: 'lang2024-aifs',
    authors: 'Simon Lang, Mihai Alexe, Matthew Chantry, Jesper Dramsch et al.',
    year: 2024,
    title: 'AIFS – ECMWF’s data-driven forecasting system',
    venue: 'arXiv preprint 2406.01465 (no journal version found as of 2026-11-15)',
    doi: '10.48550/arXiv.2406.01465',
    url: 'https://arxiv.org/abs/2406.01465',
    topic: 'ml-weather',
    finding:
      'AIFS uses a graph-neural-network encoder and decoder with a sliding-window transformer processor, trained on ERA5 and ECMWF operational analyses. It produces highly skilled forecasts for upper-air variables, surface weather parameters and tropical-cyclone tracks, runs four times daily alongside the IFS, and is published under ECMWF’s open-data policy.',
    usedFor:
      'Primary description of the ECMWF AIFS member of the seven-model ensemble. Preprint; for a peer-reviewed AIFS reference, cite moldovan2026-aifs-single-1-1.',
    verified: true,
  },
  {
    id: 'lang2024-aifs-crps',
    authors: 'Simon Lang, Mihai Alexe, Mariana C. A. Clare, Christopher Roberts et al.',
    year: 2024,
    title: 'AIFS-CRPS: Ensemble forecasting using a model trained with a loss function based on the Continuous Ranked Probability Score',
    venue: 'arXiv preprint 2412.15832',
    doi: '10.48550/arXiv.2412.15832',
    url: 'https://arxiv.org/abs/2412.15832',
    topic: 'ml-weather',
    finding:
      'An AIFS variant trained with an ‘almost fair’ CRPS loss generates any number of exchangeable ensemble members. In the medium range it outperforms the IFS ensemble for the majority of variables and lead times. Sub-seasonally it beats the IFS ensemble before calibration and is competitive when forecasts are evaluated as anomalies.',
    usedFor:
      'Background for AIFS ENS (operational 1 July 2025). Shows the same CRPS used to verify Astraeus is used to train ECMWF’s ML ensemble.',
    verified: true,
  },
  {
    id: 'moldovan2026-aifs-single-1-1',
    authors: 'Gabriel Moldovan, Ewan Pinnington, Ana Prieto Nemesio, Simon Lang et al.',
    year: 2026,
    title: 'AIFS Single 1.1.0: an update to ECMWF’s machine-learned weather forecast model AIFS',
    venue: 'Geoscientific Model Development, 19(10), 4703–4724',
    doi: '10.5194/gmd-19-4703-2026',
    url: 'https://doi.org/10.5194/gmd-19-4703-2026',
    topic: 'ml-weather',
    finding:
      'AIFS Single has been operational since 25 February 2025. Version 1.1.0 adds a bounding-layer framework that enforces physical constraints, such as non-negative precipitation. Overall skill improves by 4–6% in upper-air and near-surface variables. Precipitation improves by up to 12%, equivalent to about a 1-day advantage on a categorical skill measure, and the drizzle bias is reduced.',
    usedFor:
      'Peer-reviewed citation for AIFS and its precipitation behaviour. Note that AIFS was upgraded again to v2 on 12 May 2026 (ECMWF TM 938).',
    verified: true,
  },
  {
    id: 'rasp2024-weatherbench2',
    authors: 'Stephan Rasp, Stephan Hoyer, Alexander Merose, Ian Langmore et al.',
    year: 2024,
    title: 'WeatherBench 2: A Benchmark for the Next Generation of Data-Driven Global Weather Models',
    venue: 'Journal of Advances in Modeling Earth Systems, 16(6), e2023MS004019',
    doi: '10.1029/2023MS004019',
    url: 'https://doi.org/10.1029/2023MS004019',
    topic: 'ml-weather',
    finding:
      'Provides an open-source evaluation framework, public training, ground-truth and baseline data, and a continuously updated leaderboard for 1–14-day global forecasting. Metrics follow established practice at operational centres, headline scores summarise performance, and caveats of the evaluation setup are discussed. The abstract reports no single headline skill number.',
    usedFor:
      'Methodological precedent for verifying many models against ERA5 with shared headline scores.',
    verified: true,
  },

  // ─────────────────────── Weather → commodity: natural gas ───────────────────────
  {
    id: 'mu2007-gas-weather',
    authors: 'Xiaoyi Mu',
    year: 2007,
    title: 'Weather, storage, and natural gas price dynamics: Fundamentals and volatility',
    venue: 'Energy Economics, 29(1), 46–63',
    doi: '10.1016/j.eneco.2006.04.003',
    url: 'https://doi.org/10.1016/j.eneco.2006.04.003',
    topic: 'weather-commodity',
    finding:
      'Weather shocks have a significant effect on both the conditional mean and the conditional volatility of US natural-gas futures returns. Volatility is higher on Mondays and on storage-report release days, and the Samuelson (maturity) effect is supported. Checked against the abstract via a university repository; coefficients were not checked.',
    usedFor:
      'Supports a gas-demand channel from temperature anomalies to Henry Hub returns and volatility. No effect size is carried into Astraeus.',
    verified: true,
  },
  {
    id: 'hu2014-temperature-shock',
    authors: 'John Wei-Shan Hu, Yi-Chung Hu, Chien-Yu Lin',
    year: 2014,
    title: 'Effect of Temperature Shock and Inventory Surprises on Natural Gas and Heating Oil Futures Returns',
    venue: 'The Scientific World Journal, 2014, 457636',
    doi: '10.1155/2014/457636',
    url: 'https://doi.org/10.1155/2014/457636',
    topic: 'weather-commodity',
    finding:
      'The expected temperature shock significantly and positively affects near- and far-month natural-gas and heating-oil futures returns, and affects both conditional mean and volatility. Weighted multi-station temperatures explain returns better than a single station.',
    usedFor:
      'Supports demand-weighted (not single-city) temperature aggregation. Lower-profile venue; corroborating evidence only.',
    verified: true,
  },
  {
    id: 'chen2023-hourly-hdd',
    authors: 'Yanting Chen, Peter R. Hartley, Yihui Lan',
    year: 2023,
    title: 'Temperature, storage, and natural gas futures prices',
    venue: 'Journal of Futures Markets, 43(4), 549–575',
    doi: '10.1002/fut.22402',
    url: 'https://doi.org/10.1002/fut.22402',
    topic: 'weather-commodity',
    finding:
      'HDD/CDD measures built from hourly temperatures capture how long and how far temperatures depart from comfort level, intraday variability and thermal inertia. With economically weighted regional aggregation and model-based expectations, they are important for explaining weekly storage changes and daily US natural-gas futures price changes and variance.',
    usedFor:
      'Same paper as the ‘gas’ entry in commodityPapers.ts. Supports degree-day duration and magnitude features and consumption weighting.',
    verified: true,
  },
  {
    id: 'monteux2025-extreme-forecast-premium',
    authors: 'Manou Monteux, Maria Cristina Arcuri, Gino Gandolfi, Stefano Caselli',
    year: 2025,
    title: 'Can extreme weather forecasts lead to a risk premium? Evidence of a non-linear response in U.S. natural gas futures',
    venue: 'The North American Journal of Economics and Finance, 80, 102494',
    doi: '10.1016/j.najef.2025.102494',
    url: 'https://doi.org/10.1016/j.najef.2025.102494',
    topic: 'weather-commodity',
    finding:
      'Uses 30 years of hourly observed and daily forecast temperatures for major US metropolitan areas and NYMEX Henry Hub futures returns. Proposes a risk premium linked to extreme weather forecasts that outperformed the S&P 500 on an absolute and risk-adjusted basis over the 30 years, with a non-linear price response.',
    usedFor:
      'Peer-reviewed evidence that forecast temperatures, especially extremes, carry price information for Henry Hub. Supports nonlinear (tail) features rather than linear HDD sensitivity.',
    verified: true,
  },
  {
    id: 'hsu2026-forecast-revisions-wp',
    authors: 'Kuang-Chun Hsu, Sohee Park, Zhen Zhu',
    year: 2026,
    title: 'Weather Forecasts, Forecast Revisions, and Natural Gas Price Discovery',
    venue: 'SSRN working paper (not peer-reviewed; an earlier SSRN version is 10.2139/ssrn.6985300)',
    doi: '10.2139/ssrn.7411255',
    url: 'https://doi.org/10.2139/ssrn.7411255',
    topic: 'weather-commodity',
    finding:
      'With weather forecasts up to 14 days ahead, forecasts and forecast revisions, rather than realized weather, have significant effects on natural-gas prices. Warmer-than-expected and colder-than-expected revisions produce asymmetric effects. Storage announcements affect spot prices only on the following trading day. The revision effect is not observed in crude oil.',
    usedFor:
      'The most direct evidence for the Astraeus premise that forecast revisions, not observations, move gas prices. It is an unrefereed working paper: label it as such and do not quote it as established.',
    verified: true,
  },
  {
    id: 'linn2004-storage-report',
    authors: 'Scott C. Linn, Zhen Zhu',
    year: 2004,
    title: 'Natural gas prices and the gas storage report: Public news and volatility in energy futures markets',
    venue: 'Journal of Futures Markets, 24(3), 283–313',
    doi: '10.1002/fut.10115',
    url: 'https://doi.org/10.1002/fut.10115',
    topic: 'weather-commodity',
    finding:
      'Using intraday NYMEX natural-gas futures prices (1999–2002), the weekly gas storage report caused considerable volatility at release, and volatility stayed above normal for up to 30 minutes afterwards.',
    usedFor:
      'Explains why weather signals should be read alongside the weekly EIA storage release, which is itself largely weather-driven.',
    verified: true,
  },
  {
    id: 'gay2009-storage-analysts',
    authors: 'Gerald D. Gay, Betty J. Simkins, Marian Turac',
    year: 2009,
    title: 'Analyst forecasts and price discovery in futures markets: The case of natural gas storage',
    venue: 'Journal of Futures Markets, 29(5), 451–477',
    doi: '10.1002/fut.20368',
    url: 'https://doi.org/10.1002/fut.20368',
    topic: 'weather-commodity',
    finding:
      'The market conditions its expectation of the weekly storage number on analyst forecasts, beyond statistical models. It weights individual analysts by prior accuracy, giving more weight to long-term than recent accuracy.',
    usedFor:
      'Defines a storage ‘surprise’ as actual minus analyst consensus, not actual minus a weather-only model.',
    verified: true,
  },
  {
    id: 'halova2014-noisy-inventory',
    authors: 'Marketa W. Halova, Alexander Kurov, Oleg Kucher',
    year: 2014,
    title: 'Noisy Inventory Announcements and Energy Prices',
    venue: 'Journal of Futures Markets, 34(10), 911–933',
    doi: '10.1002/fut.21633',
    url: 'https://doi.org/10.1002/fut.21633',
    topic: 'weather-commodity',
    finding:
      'Measurement error in inventory surprises biases OLS price-impact estimates downward. Identification-through-censoring estimates are about twice OLS for petroleum and about four times OLS for natural gas.',
    usedFor:
      'Warns that naive regressions of price on a noisy surprise proxy, including weather-implied storage surprises, understate the true sensitivity.',
    verified: true,
  },
  {
    id: 'brown2008-gas-drivers',
    authors: 'Stephen P. A. Brown, Mine K. Yücel',
    year: 2008,
    title: 'What Drives Natural Gas Prices?',
    venue: 'The Energy Journal, 29(2), 45–60',
    doi: '10.5547/ISSN0195-6574-EJ-Vol29-No2-3',
    url: 'https://doi.org/10.5547/ISSN0195-6574-EJ-Vol29-No2-3',
    topic: 'weather-commodity',
    finding:
      'Analysts emphasise weather and inventories, but an error-correction model shows that crude-oil prices have a prominent role once these and other factors are included.',
    usedFor:
      'Reminder that weather is one driver among several; the sample predates the shale era and US LNG exports.',
    verified: true,
  },
  {
    id: 'nick2014-german-gas-svar',
    authors: 'Sebastian Nick, Stefan Thoenes',
    year: 2014,
    title: 'What drives natural gas prices? — A structural VAR approach',
    venue: 'Energy Economics, 45, 517–527',
    doi: '10.1016/j.eneco.2014.08.010',
    url: 'https://doi.org/10.1016/j.eneco.2014.08.010',
    topic: 'weather-commodity',
    finding:
      'In a structural VAR for the German gas market, short-term prices are affected by temperature, storage and supply shortfalls. Long-term prices are closely tied to crude-oil and coal prices.',
    usedFor:
      'European (TTF-type) evidence for a short-run temperature channel. Long-run levels follow fuel substitution, not weather.',
    verified: true,
  },

  // ───────────────────── Weather → commodity: grains & oilseeds ─────────────────────
  {
    id: 'schlenker2009-nonlinear-heat',
    authors: 'Wolfram Schlenker, Michael J. Roberts',
    year: 2009,
    title: 'Nonlinear temperature effects indicate severe damages to U.S. crop yields under climate change',
    venue: 'Proceedings of the National Academy of Sciences, 106(37), 15594–15598',
    doi: '10.1073/pnas.0906865106',
    url: 'https://doi.org/10.1073/pnas.0906865106',
    topic: 'weather-commodity',
    finding:
      'US county yields increase with temperature up to 29 °C for corn, 30 °C for soybeans and 32 °C for cotton, and fall sharply above these thresholds; the decline is steeper than the incline. Holding growing regions fixed, average yields are projected to fall 30–46% by 2100 under the slowest warming scenario (B1) and 63–82% under the fastest (A1FI; Hadley III).',
    usedFor:
      'Basis for extreme-degree-day (above-threshold) heat features for corn and soy. Yield evidence, not a futures-return model (consistent with commodityPapers ‘heat’).',
    verified: true,
  },
  {
    id: 'roberts2013-elasticities',
    authors: 'Michael J. Roberts, Wolfram Schlenker',
    year: 2013,
    title: 'Identifying Supply and Demand Elasticities of Agricultural Commodities: Implications for the US Ethanol Mandate',
    venue: 'American Economic Review, 103(6), 2265–2295',
    doi: '10.1257/aer.103.6.2265',
    url: 'https://doi.org/10.1257/aer.103.6.2265',
    topic: 'weather-commodity',
    finding:
      'Uses past (weather-driven) yield shocks, which change inventories and futures prices, as exogenous price shifters to identify supply elasticities for corn, rice, soybeans and wheat. For the 2009 Renewable Fuel Standard, prices rise 20% if one-third of ethanol feedstock is recycled as feed (positively skewed 95% CI 14–35%).',
    usedFor:
      'Explains why modest weather-driven quantity shocks can move staple prices a lot when supply and demand are inelastic. Elasticities are not loaded as live coefficients (consistent with commodityPapers ‘elasticity’).',
    verified: true,
  },
  {
    id: 'lobell2011-climate-trends',
    authors: 'David B. Lobell, Wolfram Schlenker, Justin Costa-Roberts',
    year: 2011,
    title: 'Climate Trends and Global Crop Production Since 1980',
    venue: 'Science, 333(6042), 616–620',
    doi: '10.1126/science.1204531',
    url: 'https://doi.org/10.1126/science.1204531',
    topic: 'weather-commodity',
    finding:
      'In most countries except the United States, 1980–2008 growing-season temperature trends exceeded one standard deviation of year-to-year variability. Relative to a counterfactual without climate trends, global maize and wheat production fell by 3.8% and 5.5%, while soybean and rice gains and losses largely balanced out.',
    usedFor:
      'Context that weather-yield sensitivity is global and crop-specific. The abstract gives no price effect, so none is claimed.',
    verified: true,
  },
  {
    id: 'cornejo2026-midwest-prices',
    authors: 'Magdalena Cornejo, Ezequiel Merovich, Nicolas Merener',
    year: 2026,
    title: 'Hot dry spells and extreme rain increased corn and soybean prices in the United States Midwest',
    venue: 'Communications Sustainability, 1, 17',
    doi: '10.1038/s44458-025-00016-4',
    url: 'https://doi.org/10.1038/s44458-025-00016-4',
    topic: 'weather-commodity',
    finding:
      'With weather, crop and price data for 1971–2019, hot dry spells and excessive summer rain in the US Midwest contributed to contemporaneous increases in CME corn and soybean prices. In extreme cases, predicted market responses to weather shocks were comparable to a 10% price increase, and the effect of excessively wet spells strengthened in later decades.',
    usedFor:
      'Direct peer-reviewed weather-to-price evidence for corn and soy, with an effect size. Supports two-sided (heat-drought and excess-rain) signals. Uses realized weather, not forecasts.',
    verified: true,
  },
  {
    id: 'lehecka2014-crop-condition',
    authors: 'Georg V. Lehecka',
    year: 2014,
    title: 'The Value of USDA Crop Progress and Condition Information: Reactions of Corn and Soybean Futures Markets',
    venue: 'Journal of Agricultural and Resource Economics, 39(1), 88–105',
    doi: '10.22004/ag.econ.168261',
    url: 'https://doi.org/10.22004/ag.econ.168261',
    topic: 'weather-commodity',
    finding:
      'For 1986–2012, close-to-open return variability in corn and soybean futures differs significantly on crop-condition report days from days before and after. Prices react rapidly and rationally. Reactions are strongest in July and August, when weather is most critical for the crop, and have grown over time.',
    usedFor:
      'Supports concentrating crop-weather signals in the July–August critical window, and treating weekly crop-condition reports as the market’s scoring of realized weather. DOI is the AgEcon Search (DataCite) DOI.',
    verified: true,
  },
  {
    id: 'adjemian2012-wasde',
    authors: 'Michael K. Adjemian',
    year: 2012,
    title: 'Quantifying the WASDE Announcement Effect',
    venue: 'American Journal of Agricultural Economics, 94(1), 238–256',
    doi: '10.1093/ajae/aar131',
    url: 'https://doi.org/10.1093/ajae/aar131',
    topic: 'weather-commodity',
    finding:
      'For cotton, soybeans and hard winter wheat, the WASDE announcement effect persists across contract positions and is not limited to months that include NASS crop surveys. It is amplified when carryover is low (soybeans, wheat) and is rapidly incorporated into futures prices.',
    usedFor:
      'Context that official supply estimates move prices quickly; weather signals should be judged against those scheduled releases and stock levels.',
    verified: true,
  },
  {
    id: 'iizumi2014-enso-yields',
    authors: 'Toshichika Iizumi, Jing-Jia Luo, Andrew J. Challinor, Gen Sakurai et al.',
    year: 2014,
    title: 'Impacts of El Niño Southern Oscillation on the global yields of major crops',
    venue: 'Nature Communications, 5, 3712',
    doi: '10.1038/ncomms4712',
    url: 'https://doi.org/10.1038/ncomms4712',
    topic: 'weather-commodity',
    finding:
      'El Niño likely raises global-mean soybean yield by 2.1–5.4% but changes maize, rice and wheat yields by −4.3% to +0.8%. In La Niña years, global-mean yields of all four crops tend to be below normal (−4.5% to 0.0%).',
    usedFor:
      'ENSO-phase context for seasonal crop signals. Global means hide strong regional effects in both directions.',
    verified: true,
  },
  {
    id: 'allen1998-fao56',
    authors: 'Richard G. Allen, Luis S. Pereira, Dirk Raes, Martin Smith',
    year: 1998,
    title: 'Crop evapotranspiration – Guidelines for computing crop water requirements',
    venue: 'FAO Irrigation and Drainage Paper 56, FAO, Rome (ISBN 92-5-104219-5)',
    url: 'https://www.fao.org/4/x0490e/x0490e00.htm',
    topic: 'weather-commodity',
    finding:
      'Recommends the FAO Penman–Monteith method ‘as the sole standard method’ for reference evapotranspiration. The reference is a hypothetical crop with height 0.12 m, fixed surface resistance 70 s m⁻¹ and albedo 0.23.',
    usedFor:
      'Method citation for ET₀ and water-balance (crop water-stress) features derived from NWP temperature, humidity, wind and radiation. No DOI exists.',
    verified: true,
  },

  // ────────────────── Weather → commodity: softs (OJ, coffee) ──────────────────
  {
    id: 'roll1984-oj',
    authors: 'Richard Roll',
    year: 1984,
    title: 'Orange Juice and Weather',
    venue: 'American Economic Review, 74(5), 861–880 (JSTOR 549; no DOI)',
    url: 'https://www.jstor.org/stable/549',
    topic: 'weather-commodity',
    finding:
      'Over 98% of US frozen-concentrated-OJ production was in central Florida. OJ futures returns had a statistically significant relation with subsequent errors in National Weather Service temperature forecasts, but not with rainfall forecast errors. Even so, ‘weather surprises explain only a small fraction of the observed variability in futures prices’. Checked against the full text via the Caltech repository.',
    usedFor:
      'Classic evidence that futures prices anticipate weather-forecast errors, and that weather explains only a small share of price variance. Same paper as commodityPapers ‘roll’ (open copy: authors.library.caltech.edu/records/2de2j-w4z25).',
    verified: true,
  },
  {
    id: 'boudoukh2007-oj',
    authors: 'Jacob Boudoukh, Matthew Richardson, YuQing (Jeff) Shen, Robert F. Whitelaw',
    year: 2007,
    title: 'Do asset prices reflect fundamentals? Freshly squeezed evidence from the OJ market',
    venue: 'Journal of Financial Economics, 83(2), 397–412',
    doi: '10.1016/j.jfineco.2004.06.017',
    url: 'https://doi.org/10.1016/j.jfineco.2004.06.017',
    topic: 'weather-commodity',
    finding:
      'When fundamentals matter (temperatures near or below freezing), a nonlinear, state-dependent model explains approximately 50% of OJ futures return variation. Only 4.5% of winter days have freezing temperatures, yet they account for two-thirds of winter return variability; at other temperatures there is little relation. Numbers are from the abstract of the working-paper version (NBER WP 9515); the JFE abstract was not accessible.',
    usedFor:
      'The key evidence for state-dependent weather signals: frost or threshold events matter far more than average temperature. Supports gating price-pressure signals on threshold proximity.',
    verified: true,
  },
  {
    id: 'ico2021-frost-report',
    authors: 'International Coffee Organization',
    year: 2021,
    title: 'Coffee Market Report – July 2021',
    venue: 'International Coffee Organization (official market report; not peer-reviewed)',
    url: 'https://ico.org/documents/cy2020-21/cmr-0721-e.pdf',
    topic: 'weather-commodity',
    finding:
      'After the severe frost that hit Brazil’s coffee belt on 20 July 2021, the New York (Arabica) daily price rose 25.4% in one week, from 165.65 to 207.8 US cents/lb (20–26 July). The July average of the ICO composite indicator, 152.24 US cents/lb, was the highest since November 2014, and intra-day volatility reached as high as 17%.',
    usedFor:
      'Documented frost-to-price event with magnitudes for the coffee module. A single event, not an estimated elasticity. No peer-reviewed frost/coffee price study could be verified.',
    verified: true,
  },
  {
    id: 'vizcarrondo2023-coffee-premium',
    authors: 'Esteban Vizcarrondo, Joe Janzen',
    year: 2023,
    title: 'The Weather Risk Premium in Coffee Futures Prices',
    venue: 'farmdoc daily, 13:237, University of Illinois (extension article; not peer-reviewed)',
    url: 'https://farmdocdaily.illinois.edu/2023/12/the-weather-risk-premium-in-coffee-futures-prices.html',
    topic: 'weather-commodity',
    finding:
      'Descriptive analysis of September ICE Arabica (KC) futures over about thirteen years. Pre-harvest prices averaged above the harvest-time price (about +13%, +8% in February and +3% in May) and often declined when feared weather did not occur. 2016 and 2021, years of Brazilian frost and drought, were exceptions. The authors call this ‘suggestive evidence’ of a weather risk premium.',
    usedFor:
      'Supports showing that pre-harvest coffee prices already embed frost risk, so a frost forecast that does not verify can be bearish. Descriptive only.',
    verified: true,
  },
  {
    id: 'ubilava2012-enso-coffee',
    authors: 'David Ubilava',
    year: 2012,
    title: 'El Niño, La Niña, and world coffee price dynamics',
    venue: 'Agricultural Economics, 43(1), 17–26',
    doi: '10.1111/j.1574-0862.2011.00562.x',
    url: 'https://doi.org/10.1111/j.1574-0862.2011.00562.x',
    topic: 'weather-commodity',
    finding:
      'Using monthly data from March 1989 to December 2010 and smooth-transition autoregressions with generalised impulse responses, ENSO events have short-term impacts on world coffee prices.',
    usedFor:
      'ENSO-conditioning for the coffee module. The abstract gives no effect size.',
    verified: true,
  },

  // ────────────────────── Weather → commodity: ENSO & prices ──────────────────────
  {
    id: 'brunner2002-enso-prices',
    authors: 'Allan D. Brunner',
    year: 2002,
    title: 'El Niño and World Primary Commodity Prices: Warm Water or Hot Air?',
    venue: 'Review of Economics and Statistics, 84(1), 176–183',
    doi: '10.1162/003465302317332008',
    url: 'https://doi.org/10.1162/003465302317332008',
    topic: 'weather-commodity',
    finding:
      'A one-standard-deviation positive ENSO surprise raises real non-oil commodity price inflation by about 3.5–4 percentage points. ENSO accounted for almost 20% of commodity price inflation movements over the years preceding the study, and for roughly 10–20% of movements in G-7 consumer price inflation and world activity.',
    usedFor:
      'Headline macro evidence that ENSO moves aggregate commodity prices, with effect size. Use for seasonal context, not daily signals.',
    verified: true,
  },
  {
    id: 'cashin2017-el-nino',
    authors: 'Paul Cashin, Kamiar Mohaddes, Mehdi Raissi',
    year: 2017,
    title: 'Fair weather or foul? The macroeconomic effects of El Niño',
    venue: 'Journal of International Economics, 106, 37–54',
    doi: '10.1016/j.jinteco.2017.01.010',
    url: 'https://doi.org/10.1016/j.jinteco.2017.01.010',
    topic: 'weather-commodity',
    finding:
      'A multi-country model of 21 economies/regions (1979Q2–2013Q1) shows heterogeneous responses to El Niño. Activity falls briefly in Australia, Chile, Indonesia, India, Japan, New Zealand and South Africa but is growth-enhancing in the US and Europe. Most countries see short-run inflationary pressure as both energy and non-fuel commodity prices rise. The abstract gives no commodity-price effect size.',
    usedFor:
      'Supports El Niño as a cross-commodity, cross-country price-pressure state.',
    verified: true,
  },
  {
    id: 'ubilava2018-enso-predictability',
    authors: 'David Ubilava',
    year: 2018,
    title: 'The Role of El Niño Southern Oscillation in Commodity Price Movement and Predictability',
    venue: 'American Journal of Agricultural Economics, 100(1), 239–263',
    doi: '10.1093/ajae/aax060',
    url: 'https://doi.org/10.1093/ajae/aax060',
    topic: 'weather-commodity',
    finding:
      'Across 43 monthly primary commodity prices (1980–2016) and Niño3.4 SST anomalies, price responses are more amplified during El Niño and at the onset of the ENSO cycle. SST anomalies are significantly linked to a subset of agricultural prices and improve forecasts for commodities produced in the tropics. For timber and metals there is some in-sample evidence but no out-of-sample predictability.',
    usedFor:
      'Restricts ENSO-based price pressure to tropical agricultural commodities; do not apply it to metals.',
    verified: true,
  },

  // ──────────────────────────── Forecast econometrics ────────────────────────────
  {
    id: 'diebold1995-dm',
    authors: 'Francis X. Diebold, Roberto S. Mariano',
    year: 1995,
    title: 'Comparing Predictive Accuracy',
    venue: 'Journal of Business & Economic Statistics, 13(3), 253–263',
    doi: '10.1080/07350015.1995.10524599',
    url: 'https://doi.org/10.1080/07350015.1995.10524599',
    topic: 'econometrics',
    finding:
      'Proposes tests of the null of equal accuracy of two competing forecasts. The loss function need not be quadratic or symmetric, and forecast errors may be non-Gaussian, non-zero-mean, serially correlated and contemporaneously correlated. Both asymptotic and exact finite-sample tests are given.',
    usedFor:
      'Model-vs-model comparison of NWP sources (e.g. per-lead CRPS or MAE loss differentials) and of signal vs baseline.',
    verified: true,
  },
  {
    id: 'harvey1997-hln',
    authors: 'David Harvey, Stephen Leybourne, Paul Newbold',
    year: 1997,
    title: 'Testing the equality of prediction mean squared errors',
    venue: 'International Journal of Forecasting, 13(2), 281–291',
    doi: '10.1016/S0169-2070(96)00719-4',
    url: 'https://doi.org/10.1016/S0169-2070(96)00719-4',
    topic: 'econometrics',
    finding:
      'Recommends a modified Diebold–Mariano statistic for small samples and multi-step forecasts. The DM statistic is multiplied by a finite-sample correction that depends on sample size and horizon h, and compared with Student-t(n−1) rather than normal critical values. Citation metadata was confirmed in Crossref, but the abstract was paywalled: the details come from consistent secondary documentation (RePEc partial abstract, the R fDMA mdmtest docs, the Estima manual), not the original text.',
    usedFor:
      'Small-sample correction for DM tests on short verification windows and multi-day lead times.',
    verified: false,
  },
  {
    id: 'clark2007-cw',
    authors: 'Todd E. Clark, Kenneth D. West',
    year: 2007,
    title: 'Approximately normal tests for equal predictive accuracy in nested models',
    venue: 'Journal of Econometrics, 138(1), 291–311',
    doi: '10.1016/j.jeconom.2006.05.023',
    url: 'https://doi.org/10.1016/j.jeconom.2006.05.023',
    topic: 'econometrics',
    finding:
      'Under the null that the parsimonious model generates the data, the larger nested model adds noise by estimating parameters whose true value is zero, so a raw MSPE comparison is biased towards the small model. The proposed adjusted-MSPE statistic with standard normal critical values gives actual size close to, but a little below, nominal.',
    usedFor:
      'Testing whether adding weather features to a price-only baseline improves out-of-sample forecasts (nested comparison).',
    verified: true,
  },
  {
    id: 'pesaran1992-pt',
    authors: 'M. Hashem Pesaran, Allan Timmermann',
    year: 1992,
    title: 'A Simple Nonparametric Test of Predictive Performance',
    venue: 'Journal of Business & Economic Statistics, 10(4), 461–465',
    doi: '10.1080/07350015.1992.10509922',
    url: 'https://doi.org/10.1080/07350015.1992.10509922',
    topic: 'econometrics',
    finding:
      'Derives a distribution-free test of forecast accuracy in predicting the direction of change, extended to m×n contingency tables. The standard chi-squared independence test is generally more conservative. Pages 461–465 per Crossref and the JBES issue listing; RePEc lists 561–565 in error.',
    usedFor:
      'Testing directional (up/down) price-pressure hit rates against chance.',
    verified: true,
  },
  {
    id: 'campbell2008-oos',
    authors: 'John Y. Campbell, Samuel B. Thompson',
    year: 2008,
    title: 'Predicting Excess Stock Returns Out of Sample: Can Anything Beat the Historical Average?',
    venue: 'Review of Financial Studies, 21(4), 1509–1531',
    doi: '10.1093/rfs/hhm055',
    url: 'https://doi.org/10.1093/rfs/hhm055',
    topic: 'econometrics',
    finding:
      'Many predictive regressions beat the historical-average return once weak sign restrictions are imposed on coefficients and return forecasts. Out-of-sample explanatory power is small but economically meaningful for mean-variance investors.',
    usedFor:
      'Out-of-sample R² against a historical-mean benchmark, and economically motivated sign restrictions on weather→price coefficients.',
    verified: true,
  },
  {
    id: 'welch2008-goyal',
    authors: 'Ivo Welch, Amit Goyal',
    year: 2008,
    title: 'A Comprehensive Look at The Empirical Performance of Equity Premium Prediction',
    venue: 'Review of Financial Studies, 21(4), 1455–1508',
    doi: '10.1093/rfs/hhm014',
    url: 'https://doi.org/10.1093/rfs/hhm014',
    topic: 'econometrics',
    finding:
      'Variables proposed in the literature have, by and large, predicted the equity premium poorly both in sample and out of sample for 30 years. The models appear unstable and would not have helped a real-time investor time the market.',
    usedFor:
      'Standard for reporting price-signal performance strictly out of sample, against naive benchmarks.',
    verified: true,
  },
  {
    id: 'benjamini1995-fdr',
    authors: 'Yoav Benjamini, Yosef Hochberg',
    year: 1995,
    title: 'Controlling the False Discovery Rate: A Practical and Powerful Approach to Multiple Testing',
    venue: 'Journal of the Royal Statistical Society Series B, 57(1), 289–300',
    doi: '10.1111/j.2517-6161.1995.tb02031.x',
    url: 'https://doi.org/10.1111/j.2517-6161.1995.tb02031.x',
    topic: 'econometrics',
    finding:
      'Proposes controlling the false discovery rate (expected proportion of false rejections) instead of the familywise error rate. A simple sequential Bonferroni-type procedure controls FDR for independent test statistics with substantially more power.',
    usedFor:
      'Multiple-testing control when screening many commodity × region × lead-time weather signals (already referenced in RESEARCH_STANDARDS.md).',
    verified: true,
  },

  // ─────────────────────────────── Visualisation ───────────────────────────────
  {
    id: 'padilla2021-uncertainty-vis',
    authors: 'Lace Padilla, Matthew Kay, Jessica Hullman',
    year: 2021,
    title: 'Uncertainty Visualization',
    venue: 'Wiley StatsRef: Statistics Reference Online, 1–18',
    doi: '10.1002/9781118445112.stat08296',
    url: 'https://doi.org/10.1002/9781118445112.stat08296',
    topic: 'visualisation',
    finding:
      'Reviews conventional and state-of-the-art uncertainty visualisation techniques and the cognitive theories that explain how people reason with them, with best-practice guidance and the trade-offs of each approach.',
    usedFor:
      'Design rationale for showing calibrated predictive intervals and distributions instead of bare point forecasts.',
    verified: true,
  },
  {
    id: 'kay2016-quantile-dotplots',
    authors: 'Matthew Kay, Tara Kola, Jessica R. Hullman, Sean A. Munson',
    year: 2016,
    title: 'When (ish) is My Bus? User-centered Visualizations of Uncertainty in Everyday, Mobile Predictive Systems',
    venue: 'Proceedings of the 2016 CHI Conference on Human Factors in Computing Systems, 5092–5103',
    doi: '10.1145/2858036.2858558',
    url: 'https://doi.org/10.1145/2858036.2858558',
    topic: 'visualisation',
    finding:
      'Introduces quantile dotplots for small screens. In a controlled experiment they reduced the variance of users’ probabilistic estimates by about 1.15 times compared with density plots and allowed more confident estimation.',
    usedFor:
      'Supports quantile dotplots for mobile views of rainfall or temperature predictive distributions.',
    verified: true,
  },
  {
    id: 'fernandes2018-dotplots-decisions',
    authors: 'Michael Fernandes, Logan Walls, Sean Munson, Jessica Hullman, Matthew Kay',
    year: 2018,
    title: 'Uncertainty Displays Using Quantile Dotplots or CDFs Improve Transit Decision-Making',
    venue: 'Proceedings of the 2018 CHI Conference on Human Factors in Computing Systems, 1–12',
    doi: '10.1145/3173574.3173718',
    url: 'https://doi.org/10.1145/3173574.3173718',
    topic: 'visualisation',
    finding:
      'In an incentivised experiment, decisions using 50-outcome quantile dotplots achieved expected payoffs of 97% of optimal (95% CI 95–98%), 5 percentage points above a no-uncertainty control, and were more consistent. CDF plots performed nearly as well, and both beat textual uncertainty.',
    usedFor:
      'Evidence that showing the distribution improves decisions, not just comprehension.',
    verified: true,
  },
  {
    id: 'joslyn2012-uncertainty-weather',
    authors: 'Susan L. Joslyn, Jared E. LeClerc',
    year: 2012,
    title: 'Uncertainty forecasts improve weather-related decisions and attenuate the effects of forecast error',
    venue: 'Journal of Experimental Psychology: Applied, 18(1), 126–140',
    doi: '10.1037/a0025185',
    url: 'https://doi.org/10.1037/a0025185',
    topic: 'visualisation',
    finding:
      'In three road-salting experiments, adding uncertainty estimates to overnight low-temperature forecasts improved decision quality and increased trust. It also reduced users’ reluctance to act when forecast error grew. Decision advice alone did not help; advice combined with uncertainty performed best.',
    usedFor:
      'Weather-specific evidence for pairing every alert with its calibrated uncertainty.',
    verified: true,
  },
  {
    id: 'crameri2020-colour',
    authors: 'Fabio Crameri, Grace E. Shephard, Philip J. Heron',
    year: 2020,
    title: 'The misuse of colour in science communication',
    venue: 'Nature Communications, 11, 5444',
    doi: '10.1038/s41467-020-19160-7',
    url: 'https://doi.org/10.1038/s41467-020-19160-7',
    topic: 'visualisation',
    finding:
      'Rainbow-like and red–green colour maps distort data through uneven colour gradients and are unreadable to people with colour-vision deficiency. Scientifically derived (perceptually uniform, CVD-friendly) colour maps report true data variations and reduce complexity.',
    usedFor:
      'Rationale for perceptually uniform, colour-blind-safe palettes on precipitation and temperature layers instead of rainbow maps.',
    verified: true,
  },
];

/**
 * Published headline skill numbers, for context only. These describe the cited
 * systems in their authors’ or ECMWF’s evaluations, not Astraeus’s own verification.
 * Values marked ‘≈’ were digitised from raster figures in ECMWF TM 938 (pixel
 * read-off calibrated to axis ticks; about ±0.1 day or ±1 percentage point) because
 * the memo text does not tabulate them.
 */
export const SKILL_CONTEXT: SkillContextEntry[] = [
  {
    claim: 'GraphCast vs the most accurate operational deterministic systems (ECMWF HRES)',
    value: 'Significantly outperforms on 90% of 1,380 verification targets; 10-day, 0.25° forecasts in under 1 minute',
    source: 'Lam et al. (2023), Science 382:1416–1421, abstract',
    url: 'https://doi.org/10.1126/science.adi2336',
    verified: true,
  },
  {
    claim: 'GenCast vs ECMWF ENS (probabilistic)',
    value: 'Greater skill than ENS on 97.2% of 1,320 targets; 15-day ensemble, 12-h steps, 0.25°, 80+ variables in 8 min',
    source: 'Price et al. (2025), Nature 637:84–90, abstract',
    url: 'https://doi.org/10.1038/s41586-024-08252-9',
    verified: true,
  },
  {
    claim: 'Pangu-Weather vs ECMWF operational IFS (deterministic)',
    value: 'Stronger deterministic results in all tested variables when verified on reanalysis; trained on 39 years of data',
    source: 'Bi et al. (2023), Nature 619:533–538, abstract',
    url: 'https://doi.org/10.1038/s41586-023-06185-3',
    verified: true,
  },
  {
    claim: 'ECMWF AIFS (Single) operational date',
    value: '25 February 2025: ‘outperforms state-of-the-art physics-based models for many measures, including tropical cyclone tracks, with gains of up to 20%’',
    source: 'ECMWF news release ‘ECMWF’s AI forecasts become operational’ (25 Feb 2025)',
    url: 'https://www.ecmwf.int/node/29308',
    verified: true,
  },
  {
    claim: 'ECMWF AIFS ENS operational date',
    value: '1 July 2025: ‘outperforms state-of-the-art physics-based models for many measures, including surface temperature, with gains of up to 20%’; 51 members at 31 km (TM 938)',
    source: 'ECMWF news release ‘ECMWF’s ensemble AI forecasts become operational’ (1 Jul 2025); ECMWF TM 938',
    url: 'https://www.ecmwf.int/en/about/media-centre/news/2025/ecmwfs-ensemble-ai-forecasts-become-operational',
    verified: true,
  },
  {
    claim: 'AIFS Single 1.1.0 skill change vs v1.0',
    value: '+4–6% overall skill in upper-air and near-surface variables; precipitation up to +12% (≈1-day advantage on a categorical score)',
    source: 'Moldovan et al. (2026), Geosci. Model Dev. 19:4703–4724, abstract',
    url: 'https://doi.org/10.5194/gmd-19-4703-2026',
    verified: true,
  },
  {
    claim: 'AIFS vs physics-based forecasts in routine ECMWF verification (2025)',
    value: 'Medium-range error reductions ‘typically of the order of 5–15%’; precipitation improved by about 10% in the medium range, equivalent to roughly 0.5–1 day of lead time',
    source: 'Haiden & Chevallier, ‘Forecast performance 2025’, ECMWF Newsletter No. 187 (2026)',
    url: 'https://www.ecmwf.int/en/newsletter/187/news/forecast-performance-2025',
    verified: true,
  },
  {
    claim: 'ECMWF primary headline score: lead time at which 500 hPa geopotential ACC (12-month mean, NH extratropics) falls below 80%',
    value: 'IFS control ≈7.0 days in 2025–26 (≈4.4 d in 1986, ≈5.0 d in 2000, ≈6.4 d in 2010, ≈6.9 d in 2020); AIFS-Single ≈7.3–7.4 d. Text: AIFS ‘on the order of half a day of lead time above’ IFS',
    source: 'Haiden et al. (2026), ECMWF Technical Memorandum No. 938, Fig. 3 (digitised) and Section 3.1 text',
    url: 'https://www.ecmwf.int/sites/default/files/elibrary/092026/81748-evaluation-of-ecmwf-forecasts.pdf',
    verified: true,
  },
  {
    claim: 'Typical day-5 skill: 500 hPa geopotential ACC, NH extratropics, Aug 2025–Jul 2026',
    value: 'IFS control ≈93%, AIFS-Single ≈95%; ensemble means ≈94% (IFS) and ≈95% (AIFS)',
    source: 'Haiden et al. (2026), ECMWF TM 938, Fig. 20 (digitised)',
    url: 'https://www.ecmwf.int/sites/default/files/elibrary/092026/81748-evaluation-of-ecmwf-forecasts.pdf',
    verified: true,
  },
  {
    claim: 'Typical day-7 skill: 500 hPa geopotential ACC, NH extratropics, Aug 2025–Jul 2026',
    value: 'IFS control ≈80%, AIFS-Single ≈83%; ensemble means ≈85% (IFS) and ≈86% (AIFS). Day 10: IFS control ≈51%, AIFS-Single ≈58%, ensemble means ≈65% / ≈67%',
    source: 'Haiden et al. (2026), ECMWF TM 938, Fig. 20 (digitised)',
    url: 'https://www.ecmwf.int/sites/default/files/elibrary/092026/81748-evaluation-of-ecmwf-forecasts.pdf',
    verified: true,
  },
  {
    claim: 'AIFS lead over IFS, and IFS lead over other global centres (upper air, NH extratropics)',
    value: 'AIFS leads IFS by ‘about one-third of a forecast day, similar to the lead of the IFS over the other centres’ (86% ACC threshold)',
    source: 'Haiden et al. (2026), ECMWF TM 938, Section 3.3 text / Fig. 21',
    url: 'https://www.ecmwf.int/sites/default/files/elibrary/092026/81748-evaluation-of-ecmwf-forecasts.pdf',
    verified: true,
  },
  {
    claim: 'ERA5 vs ERA-Interim',
    value: 'Re-forecasts gain up to one day of skill; global-mean correlation of precipitation with monthly GPCP 67% → 77%',
    source: 'Hersbach et al. (2020), QJRMS 146:1999–2049, abstract',
    url: 'https://doi.org/10.1002/qj.3803',
    verified: true,
  },
  {
    claim: 'EMOS vs bias-corrected ensemble (48-h sea-level pressure, UW mesoscale ensemble)',
    value: '9% lower RMSE, 7% lower MAE; predictive PDFs much better calibrated',
    source: 'Gneiting et al. (2005), MWR 133:1098–1118, abstract',
    url: 'https://doi.org/10.1175/MWR2904.1',
    verified: true,
  },
  {
    claim: 'BMA calibration (48-h surface temperature, Pacific Northwest)',
    value: '90% intervals 66% shorter than climatology; point-forecast RMSE 7% below best member and 8% below ensemble mean',
    source: 'Raftery et al. (2005), MWR 133:1155–1174, abstract',
    url: 'https://doi.org/10.1175/MWR2906.1',
    verified: true,
  },
  {
    claim: 'Multimodel vs best single model (TIGGE, 850 hPa and 2 m temperature)',
    value: 'Nine-model multimodel did not beat ECMWF EPS; four-best-model combination did; reforecast-calibrated ECMWF EPS comparable or superior',
    source: 'Hagedorn et al. (2012), QJRMS 138:1814–1827, abstract',
    url: 'https://doi.org/10.1002/qj.1895',
    verified: true,
  },
];
