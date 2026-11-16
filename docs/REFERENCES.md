# Astraeus — References

Bibliography for the weather layer (seven-model NWP ensemble, ERA5 verification, EMOS/NGR and censored precipitation post-processing) and the weather → commodity price-pressure signals. The machine-readable source is `src/engine/researchLibrary.ts` (`RESEARCH_LIBRARY`, `SKILL_CONTEXT`). This page and that file must stay in sync.

**Reviewed:** 15 November 2026. **Verification method:** every DOI was resolved against the Crossref REST API (`api.crossref.org/works/<doi>`). arXiv, AgEcon Search and Zenodo DOIs were resolved against the DataCite API instead. Authors, year, title, venue, volume and pages were taken from those records. Findings paraphrase the retrieved abstract, full text or official page, and numbers are copied from that source, not estimated. Entries marked **[unverified finding]** have confirmed metadata, but their summary rests on secondary descriptions only. Entries marked **[not peer-reviewed]** are working papers, official reports or extension articles.

Where to cite each group in the app: post-processing and verification references back the calibration and scoring maths. ML-weather and ECMWF references back statements about model skill. Weather → commodity references back the existence and direction of transmission channels, but none of their coefficients is used as a live Astraeus parameter (see `commodityPapers.ts` for the same caveat).

---

## 1. Statistical post-processing

- Gneiting, T., Raftery, A. E., Westveld, A. H., & Goldman, T. (2005). Calibrated probabilistic forecasting using ensemble model output statistics and minimum CRPS estimation. *Monthly Weather Review*, 133(5), 1098–1118. [doi:10.1175/MWR2904.1](https://doi.org/10.1175/MWR2904.1)
  — EMOS: Gaussian predictive distribution with a bias-corrected weighted-mean and linear-in-spread variance, fitted by minimum CRPS. For 48-h sea-level pressure it gave 9% lower RMSE and 7% lower MAE than the bias-corrected ensemble, with much better calibration.
- Raftery, A. E., Gneiting, T., Balabdaoui, F., & Polakowski, M. (2005). Using Bayesian model averaging to calibrate forecast ensembles. *Monthly Weather Review*, 133(5), 1155–1174. [doi:10.1175/MWR2906.1](https://doi.org/10.1175/MWR2906.1)
  — BMA mixture of member-centred PDFs. 90% intervals were 66% shorter than climatology, and the point forecast had RMSE 7% below the best member and 8% below the ensemble mean.
- Krishnamurti, T. N., Kishtawal, C. M., LaRow, T. E., Bachiochi, D. R., et al. (1999). Improved weather and seasonal climate forecasts from multimodel superensemble. *Science*, 285(5433), 1548–1550. [doi:10.1126/science.285.5433.1548](https://doi.org/10.1126/science.285.5433.1548)
  — A regression-weighted multimodel beat every member and the plain ensemble average.
- Cui, B., Toth, Z., Zhu, Y., & Hou, D. (2012). Bias correction for global ensemble forecast. *Weather and Forecasting*, 27(2), 396–410. [doi:10.1175/WAF-D-11-00011.1](https://doi.org/10.1175/WAF-D-11-00011.1)
  — NAEFS decaying-average (Kalman-type) bias correction, operational at NCEP since 2006. It improved all probabilistic measures out to day 5.
- Scheuerer, M., & Hamill, T. M. (2015). Statistical postprocessing of ensemble precipitation forecasts by fitting censored, shifted gamma distributions. *Monthly Weather Review*, 143(11), 4578–4596. [doi:10.1175/MWR-D-15-0061.1](https://doi.org/10.1175/MWR-D-15-0061.1)
  — CSGD regression produced reliable, sharp precipitation forecasts. Gives a closed-form CRPS for fitting (confirmed in full text). Needs a large training set.
- Messner, J. W., Mayr, G. J., Zeileis, A., & Wilks, D. S. (2014). Heteroscedastic extended logistic regression for postprocessing of ensemble guidance. *Monthly Weather Review*, 142(1), 448–456. [doi:10.1175/MWR-D-13-00271.1](https://doi.org/10.1175/MWR-D-13-00271.1)
  — Ensemble spread should drive the predictive scale, not the location.
- Messner, J. W., Mayr, G. J., Wilks, D. S., & Zeileis, A. (2014). Extending extended logistic regression: Extended versus separate versus ordered versus censored. *Monthly Weather Review*, 142(8), 3003–3014. [doi:10.1175/MWR-D-13-00355.1](https://doi.org/10.1175/MWR-D-13-00355.1)
  — Censored logistic regression predicted full distributions for wind and precipitation better than extended logistic regression.
- Messner, J. W., Mayr, G. J., & Zeileis, A. (2016). Heteroscedastic censored and truncated regression with crch. *The R Journal*, 8(1), 173 ff. [doi:10.32614/RJ-2016-012](https://doi.org/10.32614/RJ-2016-012)
  — Reference software: maximum-likelihood censored or truncated Gaussian, logistic or t models with separate location and scale regressors.
- Thorarinsdottir, T. L., & Gneiting, T. (2010). Probabilistic forecasts of wind speed: Ensemble model output statistics by using heteroscedastic censored regression. *Journal of the Royal Statistical Society Series A*, 173(2), 371–388. [doi:10.1111/j.1467-985x.2009.00616.x](https://doi.org/10.1111/j.1467-985x.2009.00616.x)
- Baran, S., & Nemoda, D. (2016). Censored and shifted gamma distribution based EMOS model for probabilistic quantitative precipitation forecasting. *Environmetrics*, 27(5), 280–292. [doi:10.1002/env.2391](https://doi.org/10.1002/env.2391)
- Gebetsberger, M., Messner, J. W., Mayr, G. J., & Zeileis, A. (2018). Estimation methods for nonhomogeneous regression models: Minimum continuous ranked probability score versus maximum likelihood. *Monthly Weather Review*, 146(12), 4323–4338. [doi:10.1175/MWR-D-17-0364.1](https://doi.org/10.1175/MWR-D-17-0364.1)
  — Divergence between min-CRPS and ML estimates signals misspecification. Heavy-tailed families fix most of it, and ML is slightly more efficient when the model is correct.
- Lerch, S., & Baran, S. (2017). Similarity-based semilocal estimation of post-processing models. *Journal of the Royal Statistical Society Series C (Applied Statistics)*, 66(1), 29–51. [doi:10.1111/rssc.12153](https://doi.org/10.1111/rssc.12153)
  — Note: JRSS C, not *Monthly Weather Review*.
- Rasp, S., & Lerch, S. (2018). Neural networks for postprocessing ensemble weather forecasts. *Monthly Weather Review*, 146(11), 3885–3900. [doi:10.1175/MWR-D-18-0187.1](https://doi.org/10.1175/MWR-D-18-0187.1)
- Vannitsem, S., Bremnes, J. B., Demaeyer, J., Evans, G. R., et al. (2021). Statistical postprocessing for weather forecasts: Review, challenges, and avenues in a big data world. *Bulletin of the American Meteorological Society*, 102(3), E681–E699. [doi:10.1175/BAMS-D-19-0308.1](https://doi.org/10.1175/BAMS-D-19-0308.1)
- Hagedorn, R., Buizza, R., Hamill, T. M., Leutbecher, M., & Palmer, T. N. (2012). Comparing TIGGE multimodel forecasts with reforecast-calibrated ECMWF ensemble forecasts. *Quarterly Journal of the Royal Meteorological Society*, 138(668), 1814–1827. [doi:10.1002/qj.1895](https://doi.org/10.1002/qj.1895)
  — A nine-model multimodel did not beat ECMWF EPS, while the four best did. Weights must reflect skill.

## 2. Forecast verification

- Gneiting, T., & Raftery, A. E. (2007). Strictly proper scoring rules, prediction, and estimation. *Journal of the American Statistical Association*, 102(477), 359–378. [doi:10.1198/016214506000001437](https://doi.org/10.1198/016214506000001437)
- Gneiting, T., Balabdaoui, F., & Raftery, A. E. (2007). Probabilistic forecasts, calibration and sharpness. *Journal of the Royal Statistical Society Series B*, 69(2), 243–268. [doi:10.1111/j.1467-9868.2007.00587.x](https://doi.org/10.1111/j.1467-9868.2007.00587.x)
- Hersbach, H. (2000). Decomposition of the continuous ranked probability score for ensemble prediction systems. *Weather and Forecasting*, 15(5), 559–570. [doi:10.1175/1520-0434(2000)015<0559:DOTCRP>2.0.CO;2](https://doi.org/10.1175/1520-0434(2000)015%3C0559:DOTCRP%3E2.0.CO;2)
- Hamill, T. M. (2001). Interpretation of rank histograms for verifying ensemble forecasts. *Monthly Weather Review*, 129(3), 550–560. [doi:10.1175/1520-0493(2001)129<0550:IORHFV>2.0.CO;2](https://doi.org/10.1175/1520-0493(2001)129%3C0550:IORHFV%3E2.0.CO;2)
- Jordan, A., Krüger, F., & Lerch, S. (2019). Evaluating probabilistic forecasts with scoringRules. *Journal of Statistical Software*, 90(12). [doi:10.18637/jss.v090.i12](https://doi.org/10.18637/jss.v090.i12)
  — The R package (v1.1.3 NAMESPACE) exports closed-form CRPS for censored normal, logistic and t distributions (`crps_cnorm`, `crps_clogis`, `crps_ct`) and generalised truncated/censored families (`crps_gtcnorm`, `crps_gtclogis`, `crps_gtct`). It has **no** censored-shifted-gamma CRPS; use Scheuerer & Hamill (2015) for that.
- Haiden, T., Janousek, M., Vitart, F., Maier-Gerber, M., Li, C. W. Y., Prates, F., & Chevallier, M. (2026). *Evaluation of ECMWF forecasts*. ECMWF Technical Memorandum No. 938. [PDF](https://www.ecmwf.int/sites/default/files/elibrary/092026/81748-evaluation-of-ecmwf-forecasts.pdf) (no DOI found)
- Bauer, P., Thorpe, A., & Brunet, G. (2015). The quiet revolution of numerical weather prediction. *Nature*, 525(7567), 47–55. [doi:10.1038/nature14956](https://doi.org/10.1038/nature14956)
  — Only the abstract was checked. The often-quoted "about one day per decade" gain is in the paywalled body and was not checked; cite ECMWF TM 938 for numbers.

## 3. Reanalysis

- Hersbach, H., Bell, B., Berrisford, P., Hirahara, S., et al. (2020). The ERA5 global reanalysis. *Quarterly Journal of the Royal Meteorological Society*, 146(730), 1999–2049. [doi:10.1002/qj.3803](https://doi.org/10.1002/qj.3803)
  — 31 km, hourly, with ensemble uncertainty. Re-forecasts gain up to one day over ERA-Interim, and the precipitation correlation with monthly GPCP rises from 67% to 77%. Caveat: ERA5 precipitation is model-derived.

## 4. Machine-learning weather models

- Lam, R., Sanchez-Gonzalez, A., Willson, M., Wirnsberger, P., et al. (2023). Learning skillful medium-range global weather forecasting. *Science*, 382(6677), 1416–1421. [doi:10.1126/science.adi2336](https://doi.org/10.1126/science.adi2336)
- Price, I., Sanchez-Gonzalez, A., Alet, F., Andersson, T. R., et al. (2025). Probabilistic weather forecasting with machine learning. *Nature*, 637(8044), 84–90 (online 4 Dec 2024). [doi:10.1038/s41586-024-08252-9](https://doi.org/10.1038/s41586-024-08252-9)
- Bi, K., Xie, L., Zhang, H., Chen, X., Gu, X., & Tian, Q. (2023). Accurate medium-range global weather forecasting with 3D neural networks. *Nature*, 619(7970), 533–538. [doi:10.1038/s41586-023-06185-3](https://doi.org/10.1038/s41586-023-06185-3)
- Lang, S., Alexe, M., Chantry, M., Dramsch, J., et al. (2024). AIFS – ECMWF's data-driven forecasting system. arXiv:2406.01465. [doi:10.48550/arXiv.2406.01465](https://doi.org/10.48550/arXiv.2406.01465) — preprint; no journal version found.
- Lang, S., Alexe, M., Clare, M. C. A., Roberts, C., et al. (2024). AIFS-CRPS: Ensemble forecasting using a model trained with a loss function based on the continuous ranked probability score. arXiv:2412.15832. [doi:10.48550/arXiv.2412.15832](https://doi.org/10.48550/arXiv.2412.15832)
- Moldovan, G., Pinnington, E., Prieto Nemesio, A., Lang, S., et al. (2026). AIFS Single 1.1.0: an update to ECMWF's machine-learned weather forecast model AIFS. *Geoscientific Model Development*, 19(10), 4703–4724. [doi:10.5194/gmd-19-4703-2026](https://doi.org/10.5194/gmd-19-4703-2026) — peer-reviewed AIFS reference.
- Rasp, S., Hoyer, S., Merose, A., Langmore, I., et al. (2024). WeatherBench 2: A benchmark for the next generation of data-driven global weather models. *Journal of Advances in Modeling Earth Systems*, 16(6), e2023MS004019. [doi:10.1029/2023MS004019](https://doi.org/10.1029/2023MS004019)

### Published skill context (`SKILL_CONTEXT`)

Values marked ≈ were digitised from raster figures in ECMWF TM 938, calibrated to the axis ticks (about ±0.1 day or ±1 pp). The memo text does not tabulate them.

| Claim | Value | Source |
|---|---|---|
| GraphCast vs HRES | Better on 90% of 1,380 targets | [Lam et al. 2023](https://doi.org/10.1126/science.adi2336) |
| GenCast vs ENS | Better on 97.2% of 1,320 targets | [Price et al. 2025](https://doi.org/10.1038/s41586-024-08252-9) |
| Pangu-Weather vs IFS | Better in all tested variables (verified on reanalysis) | [Bi et al. 2023](https://doi.org/10.1038/s41586-023-06185-3) |
| AIFS Single operational | 25 Feb 2025; gains of up to 20% on many measures incl. TC tracks | [ECMWF news](https://www.ecmwf.int/node/29308) |
| AIFS ENS operational | 1 Jul 2025; gains of up to 20% incl. surface temperature; 51 members, 31 km | [ECMWF news](https://www.ecmwf.int/en/about/media-centre/news/2025/ecmwfs-ensemble-ai-forecasts-become-operational) |
| AIFS Single 1.1.0 vs 1.0 | +4–6% upper-air/near-surface; precipitation up to +12% | [Moldovan et al. 2026](https://doi.org/10.5194/gmd-19-4703-2026) |
| AIFS vs physics (2025) | Medium-range error reductions typically 5–15%; precipitation ≈10% (≈0.5–1 day) | [ECMWF Newsletter 187](https://www.ecmwf.int/en/newsletter/187/news/forecast-performance-2025) |
| Z500 ACC 80% lead time, NH extratropics (12-month mean) | IFS ≈7.0 d (2025–26), ≈4.4 d (1986); AIFS ≈7.3–7.4 d, "on the order of half a day" above IFS | [ECMWF TM 938](https://www.ecmwf.int/sites/default/files/elibrary/092026/81748-evaluation-of-ecmwf-forecasts.pdf), Fig. 3 |
| Z500 ACC day 5 (Aug 2025–Jul 2026) | IFS ≈93%, AIFS ≈95% (ensemble means ≈94% / ≈95%) | TM 938, Fig. 20 |
| Z500 ACC day 7 | IFS ≈80%, AIFS ≈83% (ensemble means ≈85% / ≈86%); day 10: IFS ≈51%, AIFS ≈58% | TM 938, Fig. 20 |
| AIFS lead over IFS | About one-third of a forecast day, similar to IFS lead over other centres | TM 938, §3.3 |
| ERA5 vs ERA-Interim | Up to one day of skill; precip–GPCP correlation 67% → 77% | [Hersbach et al. 2020](https://doi.org/10.1002/qj.3803) |
| EMOS case study | RMSE −9%, MAE −7% vs bias-corrected ensemble | [Gneiting et al. 2005](https://doi.org/10.1175/MWR2904.1) |
| BMA case study | 90% PI 66% shorter than climatology | [Raftery et al. 2005](https://doi.org/10.1175/MWR2906.1) |
| TIGGE multimodel | Nine-model mix did not beat ECMWF EPS; four best did | [Hagedorn et al. 2012](https://doi.org/10.1002/qj.1895) |

## 5. Weather → commodity prices

### 5a. Natural gas

- Mu, X. (2007). Weather, storage, and natural gas price dynamics: Fundamentals and volatility. *Energy Economics*, 29(1), 46–63. [doi:10.1016/j.eneco.2006.04.003](https://doi.org/10.1016/j.eneco.2006.04.003)
  — Weather shocks significantly affect the conditional mean and volatility of NG futures returns. Volatility is higher on Mondays and storage-report days.
- Hu, J. W.-S., Hu, Y.-C., & Lin, C.-Y. (2014). Effect of temperature shock and inventory surprises on natural gas and heating oil futures returns. *The Scientific World Journal*, 2014, 457636. [doi:10.1155/2014/457636](https://doi.org/10.1155/2014/457636)
- Chen, Y., Hartley, P. R., & Lan, Y. (2023). Temperature, storage, and natural gas futures prices. *Journal of Futures Markets*, 43(4), 549–575. [doi:10.1002/fut.22402](https://doi.org/10.1002/fut.22402)
- Monteux, M., Arcuri, M. C., Gandolfi, G., & Caselli, S. (2025). Can extreme weather forecasts lead to a risk premium? Evidence of a non-linear response in U.S. natural gas futures. *The North American Journal of Economics and Finance*, 80, 102494. [doi:10.1016/j.najef.2025.102494](https://doi.org/10.1016/j.najef.2025.102494)
  — Uses 30 years of observed and forecast temperatures. Finds a non-linear premium tied to extreme forecasts that beat the S&P 500 on an absolute and risk-adjusted basis.
- Hsu, K.-C., Park, S., & Zhu, Z. (2026). Weather forecasts, forecast revisions, and natural gas price discovery. SSRN working paper. [doi:10.2139/ssrn.7411255](https://doi.org/10.2139/ssrn.7411255) (earlier version: [doi:10.2139/ssrn.6985300](https://doi.org/10.2139/ssrn.6985300)) **[not peer-reviewed]**
  — Forecasts and forecast revisions (up to 14 days ahead), not realized weather, move NG prices, with asymmetric warm and cold effects. No such effect appears in crude oil.
- Linn, S. C., & Zhu, Z. (2004). Natural gas prices and the gas storage report: Public news and volatility in energy futures markets. *Journal of Futures Markets*, 24(3), 283–313. [doi:10.1002/fut.10115](https://doi.org/10.1002/fut.10115)
- Gay, G. D., Simkins, B. J., & Turac, M. (2009). Analyst forecasts and price discovery in futures markets: The case of natural gas storage. *Journal of Futures Markets*, 29(5), 451–477. [doi:10.1002/fut.20368](https://doi.org/10.1002/fut.20368)
- Halova, M. W., Kurov, A., & Kucher, O. (2014). Noisy inventory announcements and energy prices. *Journal of Futures Markets*, 34(10), 911–933. [doi:10.1002/fut.21633](https://doi.org/10.1002/fut.21633)
  — Identification-through-censoring estimates are about 4× the OLS estimates for natural gas.
- Brown, S. P. A., & Yücel, M. K. (2008). What drives natural gas prices? *The Energy Journal*, 29(2), 45–60. [doi:10.5547/ISSN0195-6574-EJ-Vol29-No2-3](https://doi.org/10.5547/ISSN0195-6574-EJ-Vol29-No2-3)
- Nick, S., & Thoenes, S. (2014). What drives natural gas prices? — A structural VAR approach. *Energy Economics*, 45, 517–527. [doi:10.1016/j.eneco.2014.08.010](https://doi.org/10.1016/j.eneco.2014.08.010)

### 5b. Grains, oilseeds and crop-weather methods

- Schlenker, W., & Roberts, M. J. (2009). Nonlinear temperature effects indicate severe damages to U.S. crop yields under climate change. *PNAS*, 106(37), 15594–15598. [doi:10.1073/pnas.0906865106](https://doi.org/10.1073/pnas.0906865106)
  — Yield thresholds of 29 °C (corn), 30 °C (soy) and 32 °C (cotton).
- Roberts, M. J., & Schlenker, W. (2013). Identifying supply and demand elasticities of agricultural commodities: Implications for the US ethanol mandate. *American Economic Review*, 103(6), 2265–2295. [doi:10.1257/aer.103.6.2265](https://doi.org/10.1257/aer.103.6.2265)
  — Yield shocks are used as price shifters. The RFS raises prices 20% (95% CI 14–35%).
- Lobell, D. B., Schlenker, W., & Costa-Roberts, J. (2011). Climate trends and global crop production since 1980. *Science*, 333(6042), 616–620. [doi:10.1126/science.1204531](https://doi.org/10.1126/science.1204531)
- Cornejo, M., Merovich, E., & Merener, N. (2026). Hot dry spells and extreme rain increased corn and soybean prices in the United States Midwest. *Communications Sustainability*, 1, 17. [doi:10.1038/s44458-025-00016-4](https://doi.org/10.1038/s44458-025-00016-4)
  — In extreme cases, predicted price responses were comparable to a 10% increase.
- Lehecka, G. V. (2014). The value of USDA crop progress and condition information: Reactions of corn and soybean futures markets. *Journal of Agricultural and Resource Economics*, 39(1), 88–105. [doi:10.22004/ag.econ.168261](https://doi.org/10.22004/ag.econ.168261)
- Adjemian, M. K. (2012). Quantifying the WASDE announcement effect. *American Journal of Agricultural Economics*, 94(1), 238–256. [doi:10.1093/ajae/aar131](https://doi.org/10.1093/ajae/aar131)
- Iizumi, T., Luo, J.-J., Challinor, A. J., Sakurai, G., et al. (2014). Impacts of El Niño Southern Oscillation on the global yields of major crops. *Nature Communications*, 5, 3712. [doi:10.1038/ncomms4712](https://doi.org/10.1038/ncomms4712)
- Allen, R. G., Pereira, L. S., Raes, D., & Smith, M. (1998). *Crop evapotranspiration – Guidelines for computing crop water requirements*. FAO Irrigation and Drainage Paper 56. FAO, Rome. ISBN 92-5-104219-5. [fao.org](https://www.fao.org/4/x0490e/x0490e00.htm) (no DOI)

### 5c. Softs: orange juice and coffee

- Roll, R. (1984). Orange juice and weather. *American Economic Review*, 74(5), 861–880. [JSTOR 549](https://www.jstor.org/stable/549) (no DOI; open copy at [Caltech](https://authors.library.caltech.edu/records/2de2j-w4z25))
- Boudoukh, J., Richardson, M., Shen, Y., & Whitelaw, R. F. (2007). Do asset prices reflect fundamentals? Freshly squeezed evidence from the OJ market. *Journal of Financial Economics*, 83(2), 397–412. [doi:10.1016/j.jfineco.2004.06.017](https://doi.org/10.1016/j.jfineco.2004.06.017)
  — Near freezing, the model explains about 50% of returns; the 4.5% of winter days with freezing temperatures account for two-thirds of winter variance. Figures are from the NBER WP 9515 abstract.
- International Coffee Organization (2021). *Coffee Market Report – July 2021*. [PDF](https://ico.org/documents/cy2020-21/cmr-0721-e.pdf) **[not peer-reviewed]**
  — After the 20 July 2021 frost, the NY Arabica price rose 25.4% in one week (165.65 → 207.8 US cents/lb).
- Vizcarrondo, E., & Janzen, J. (2023). The weather risk premium in coffee futures prices. *farmdoc daily* (13):237, University of Illinois. [link](https://farmdocdaily.illinois.edu/2023/12/the-weather-risk-premium-in-coffee-futures-prices.html) **[not peer-reviewed]**
- Ubilava, D. (2012). El Niño, La Niña, and world coffee price dynamics. *Agricultural Economics*, 43(1), 17–26. [doi:10.1111/j.1574-0862.2011.00562.x](https://doi.org/10.1111/j.1574-0862.2011.00562.x)

### 5d. ENSO and commodity prices

- Brunner, A. D. (2002). El Niño and world primary commodity prices: Warm water or hot air? *Review of Economics and Statistics*, 84(1), 176–183. [doi:10.1162/003465302317332008](https://doi.org/10.1162/003465302317332008)
  — A 1-SD ENSO surprise raises real commodity price inflation by about 3.5–4 pp. ENSO accounts for almost 20% of commodity-price-inflation movements.
- Cashin, P., Mohaddes, K., & Raissi, M. (2017). Fair weather or foul? The macroeconomic effects of El Niño. *Journal of International Economics*, 106, 37–54. [doi:10.1016/j.jinteco.2017.01.010](https://doi.org/10.1016/j.jinteco.2017.01.010)
- Ubilava, D. (2018). The role of El Niño Southern Oscillation in commodity price movement and predictability. *American Journal of Agricultural Economics*, 100(1), 239–263. [doi:10.1093/ajae/aax060](https://doi.org/10.1093/ajae/aax060)

## 6. Forecast-evaluation econometrics

- Diebold, F. X., & Mariano, R. S. (1995). Comparing predictive accuracy. *Journal of Business & Economic Statistics*, 13(3), 253–263. [doi:10.1080/07350015.1995.10524599](https://doi.org/10.1080/07350015.1995.10524599)
- Harvey, D., Leybourne, S., & Newbold, P. (1997). Testing the equality of prediction mean squared errors. *International Journal of Forecasting*, 13(2), 281–291. [doi:10.1016/S0169-2070(96)00719-4](https://doi.org/10.1016/S0169-2070(96)00719-4) **[unverified finding]** — the small-sample correction and Student-t(n−1) details come from secondary documentation; the abstract is paywalled.
- Clark, T. E., & West, K. D. (2007). Approximately normal tests for equal predictive accuracy in nested models. *Journal of Econometrics*, 138(1), 291–311. [doi:10.1016/j.jeconom.2006.05.023](https://doi.org/10.1016/j.jeconom.2006.05.023)
- Pesaran, M. H., & Timmermann, A. (1992). A simple nonparametric test of predictive performance. *Journal of Business & Economic Statistics*, 10(4), 461–465. [doi:10.1080/07350015.1992.10509922](https://doi.org/10.1080/07350015.1992.10509922) — RePEc's "561–565" is wrong; Crossref and the issue listing give 461–465.
- Campbell, J. Y., & Thompson, S. B. (2008). Predicting excess stock returns out of sample: Can anything beat the historical average? *Review of Financial Studies*, 21(4), 1509–1531. [doi:10.1093/rfs/hhm055](https://doi.org/10.1093/rfs/hhm055)
- Welch, I., & Goyal, A. (2008). A comprehensive look at the empirical performance of equity premium prediction. *Review of Financial Studies*, 21(4), 1455–1508. [doi:10.1093/rfs/hhm014](https://doi.org/10.1093/rfs/hhm014)
- Benjamini, Y., & Hochberg, Y. (1995). Controlling the false discovery rate: A practical and powerful approach to multiple testing. *Journal of the Royal Statistical Society Series B*, 57(1), 289–300. [doi:10.1111/j.2517-6161.1995.tb02031.x](https://doi.org/10.1111/j.2517-6161.1995.tb02031.x)

## 7. Visualisation and uncertainty communication

- Padilla, L., Kay, M., & Hullman, J. (2021). Uncertainty visualization. In *Wiley StatsRef: Statistics Reference Online*, 1–18. [doi:10.1002/9781118445112.stat08296](https://doi.org/10.1002/9781118445112.stat08296)
- Kay, M., Kola, T., Hullman, J. R., & Munson, S. A. (2016). When (ish) is my bus? User-centered visualizations of uncertainty in everyday, mobile predictive systems. *Proc. CHI 2016*, 5092–5103. [doi:10.1145/2858036.2858558](https://doi.org/10.1145/2858036.2858558)
- Fernandes, M., Walls, L., Munson, S., Hullman, J., & Kay, M. (2018). Uncertainty displays using quantile dotplots or CDFs improve transit decision-making. *Proc. CHI 2018*, 1–12. [doi:10.1145/3173574.3173718](https://doi.org/10.1145/3173574.3173718)
- Joslyn, S. L., & LeClerc, J. E. (2012). Uncertainty forecasts improve weather-related decisions and attenuate the effects of forecast error. *Journal of Experimental Psychology: Applied*, 18(1), 126–140. [doi:10.1037/a0025185](https://doi.org/10.1037/a0025185)
- Crameri, F., Shephard, G. E., & Heron, P. J. (2020). The misuse of colour in science communication. *Nature Communications*, 11, 5444. [doi:10.1038/s41467-020-19160-7](https://doi.org/10.1038/s41467-020-19160-7)

---

## Not found or not verifiable (as of 15 Nov 2026)

- **Peer-reviewed study of corn/soy futures reacting to NWP forecast-run revisions (GFS/ECMWF):** none found. The closest peer-reviewed evidence is crop-condition reports (Lehecka 2014) and realized extreme weather (Cornejo et al. 2026). Vendor backtests exist but are not cited.
- **Peer-reviewed frost → coffee price econometric study:** none could be verified. The ICO report and farmdoc daily are cited instead and labelled as not peer-reviewed.
- **Bauer et al. (2015) "one day per decade":** body text is paywalled. ECMWF TM 938 Fig. 3 (digitised) shows roughly 4.4 → 7.0 days over 1986–2026 for the Z500 80% headline score, faster in 2000–2010 and slower since.
- **Harvey, Leybourne & Newbold (1997):** metadata verified; the finding rests on secondary sources (see above).
- **Cashin et al. (2017), Lobell et al. (2011):** the abstracts give no commodity-price effect size, so none is quoted.

## Data-access software (not in `RESEARCH_LIBRARY`; topic enum does not cover it)

- Zippenfenig, P. *Open-Meteo.com Weather API* (software). Zenodo. [doi:10.5281/zenodo.7970649](https://doi.org/10.5281/zenodo.7970649) — DataCite record checked; the latest version listed is 1.4.0 (2024).
