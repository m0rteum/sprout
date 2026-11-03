# Automatic watering plan

Goal: affordable hardware that measures soil moisture and waters plants by itself, reporting into the same Sprout household so the app shows readings and logs each watering.

## Parts (one controller, a few plants)

Prices are rough figures for common online listings and will vary.

| Part | Why | Approx. cost |
| --- | --- | --- |
| ESP32 dev board | Cheap microcontroller with built-in Wi-Fi | $5–10 |
| Capacitive soil moisture sensor (one per plant) | No exposed metal, so it doesn't corrode like the cheap resistive forks | $2–4 each |
| Small pump: 5 V submersible, or a 12 V peristaltic for precise doses | Moves water from a reservoir | $3–15 each |
| Logic-level MOSFET module (or relay) per pump, plus a flyback diode | Lets the 3.3 V ESP32 switch the pump safely | $1–3 each |
| Silicone tubing, drip stakes, a water container | Delivery | $5–10 |
| 5 V or 12 V power supply matching the pumps | Power | $5–10 |

A three-plant setup comes to roughly **$30–60**.

Wiring notes:

- Connect sensors to **ADC1** pins (GPIO 32–39). On the ESP32, ADC2 can't be read while Wi-Fi is on ([Espressif ADC docs](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/adc_oneshot.html)).
- Calibrate each sensor: note the raw reading in dry air (0%) and in a glass of water (100%), and map between the two.
- Power the sensors only while reading, through a GPIO pin. This saves power and slows wear.
- Put the reservoir *below* the plants, or add a check valve, so water can't siphon out when the pump is off.

## How it talks to Sprout

```
ESP32 ──every 30 min──► Supabase Edge Function "device-report"
        {moisture_pct}       │  checks the device token (sha256 vs devices.token_hash)
                             │  stores a sensor_readings row
                             │  decides: moisture < threshold? manual request pending?
        ◄── {water_ms: 4000} │  creates a watering_events row
ESP32 runs the pump ──► "device-report" {completed: event_id}
                             └─► completes the plant's water schedule + adds a care log
```

The tables already exist in the migration: `devices` (one row per controller, linked to a plant, with a moisture threshold and pump duration), `sensor_readings`, and `watering_events`. Row-level security covers them like the rest of the household.

## Build order

1. **Sense only.** Flash the ESP32 and report moisture. Add a moisture chart to the plant screen. Keep watering by hand and use the readings to check that Sprout's schedule matches reality.
2. **Manual pump.** Add a "Water now" button in the app that creates a pending `watering_events` row, which the device picks up on its next check-in.
3. **Automatic.** The Edge Function waters when moisture drops below the threshold, with safety limits: at most one watering per N hours, a maximum pump time, and a stop if moisture doesn't rise after watering (empty reservoir or a leak).

## Firmware options

- **ESPHome** (YAML config, no C++): reads the [ADC sensor](https://esphome.io/components/sensor/adc.html) and switches a GPIO, and can call an HTTP endpoint. This is the quickest way to get started.
- **Arduino / PlatformIO sketch**: more control over deep sleep and battery life. It would live in a `firmware/` folder in this repo.

Supabase Edge Functions docs: https://supabase.com/docs/guides/functions
