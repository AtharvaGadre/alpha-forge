# MODEL_REGISTRY.md — AlphaForge Atmosphere & ARGON Model Registry

## 1. Gemini Native Audio, Voice & Reasoning Architecture (`ARGON`)

| Role | Model Identifier | Execution Context | Purpose & Fallback |
| :--- | :--- | :--- | :--- |
| **Fast Voice Model** | `gemini-3.8-live` | Server-side WebSocket Bridge (`/api/v1/argon/live-ws`) | Low-latency bidirectional native audio streaming, tool invocation, and conversational barge-in |
| **Complex Research Voice Model** | `gemini-3.8-live-extended-thinking` | Server-side WebSocket Bridge (`/api/v1/argon/live-ws`) | Multi-step meteorological + economic hypothesis evaluation with extended thinking |
| **Spoken Briefing Synthesizer (TTS)** | `gemini-3.8-flash-lite-tts` | Server-side `/api/v1/argon/tts` | High-clarity spoken report briefings across selectable voice personas (`Zephyr`, `Kore`, `Fenrir`, `Puck`, `Charon`) with browser SpeechSynthesis fallback |
| **Structured Synthesis & Tool Planner** | `gemini-3.8-flash` | Server-side `/api/v1/assistant/query` | Structured JSON epistemic synthesis (`A`–`F` separation) backed by deterministic engine metrics |

---

## 2. Provider-Independent Weather Model Registry (`WEATHER_MODEL_REGISTRY`)

All weather forecast runs are normalized to SI/meteorological units (`°C`, `mm`, `m/s`, `hPa`, `%`) with explicit initialisation timestamps, spatial resolution, ensemble member counts, and historical out-of-sample skill scores (`RMSE`, `MAE`, `CRPS`, `Brier Skill Score`).

| Model ID | Name & Provider | Paradigm | Spatial Resolution | Update Cadence | Lead Horizon | Ensemble Members | Strengths | Known Limitations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `WEATHERNEXT_3` | **Google DeepMind WeatherNext 3** | Graph/Transformer Probabilistic Ensemble | `0.25° (~25 km)` | Every 6h (`00/06/12/18Z`) | `360h (15d)` | `64` | Calibrated tail probabilities, tropical cyclogenesis, and fast multi-member inference | Sub-grid orographic micro-climates require downscaling |
| `ECMWF_IFS` | **ECMWF IFS HRES + ENS** | Physics NWP (Coupled Ocean-Atmosphere) | `0.10° (~9 km HRES)` | Every 6h | `360h (15d)` | `51` | Gold-standard physical conservation laws, stratospheric coupling, and boundary-layer physics | Higher computational latency (~6h delivery lag) |
| `ECMWF_AIFS` | **ECMWF AIFS** | Data-Driven Graph Neural Weather Model | `0.25° (~28 km)` | Every 6h | `360h (15d)` | `51` | Strong synoptic Rossby wave and monsoon trough skill | Smoother fine-scale convective rainfall peaks than 9 km IFS |
| `GRAPHCAST_DETERMINISTIC` | **Google DeepMind GraphCast** | Multi-Mesh Graph Neural Network | `0.25° (~25 km)` | Every 6h | `240h (10d)` | `1` | High medium-range synoptic track accuracy | Deterministic single-trajectory output; smooths extreme convective cells at >7d lead |
| `NOAA_GFS` | **NOAA GFS + GEFS v12** | Finite-Volume Cubed-Sphere NWP | `0.25° (~25 km)` | Every 6h | `384h (16d)` | `31` | Open public telemetry, rapid availability, and strong North/South American coverage | Higher tropical precipitation bias than ECMWF/WeatherNext 3 |
| `WEATHERNEXT_2` | **Google DeepMind WeatherNext 2** | Diffusion Probabilistic Weather Model | `0.25° (~25 km)` | Every 6h | `240h (10d)` | `32` | Sharp mesoscale precipitation structures | Superseded on 10–15d skill by WeatherNext 3 |

---

## 3. Multi-Model Ensemble Mathematics & Calibration

1. **Constrained Inverse-CRPS Skill Combination**:
   $$\hat{y}_{t+\tau} = \sum_{i=1}^{M} w_i \hat{y}_{i, t+\tau}, \quad \text{s.t.} \quad \sum_{i=1}^{M} w_i = 1, \quad w_i \ge 0$$
2. **Ensemble Model Output Statistics (EMOS) Predictive Variance Calibration**:
   $$\sigma^2_{\text{cal}, t+\tau} = \alpha_{\text{EMOS}} + \beta_{\text{EMOS}} \cdot s^2_{\text{ens}, t+\tau}$$
   Explicitly separates **raw inter-model spread** ($s_{\text{ens}}$) from **calibrated 90% prediction intervals** ($\hat{y} \pm 1.645 \sigma_{\text{cal}}$) accounting for historical under-dispersion.
