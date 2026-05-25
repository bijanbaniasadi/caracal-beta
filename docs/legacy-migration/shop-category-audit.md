# Legacy Shop Category Audit

Generated: 2026-05-25T14:22:12.364658+00:00

## Summary

- Live old shop product count: 10452
- Extracted normalized candidates: 10452
- Current new seed SKU references: 36
- Missing from new seed: 10423
- Duplicate SKUs in extracted catalog: 0
- Categories not mapped in current seed: 11
- Local backup SQL product insert previews: 30
- Local backup product image files: 6406

## Category Counts

| Category | Slug | Old live count | Extracted count | New seed count | Mapping |
| --- | --- | ---: | ---: | ---: | --- |
| Workshop Tools | `tools` | 1 | 1 | 0 | not mapped |
| Tuning Tools | `tuning-tools` | 1387 | 1387 | 0 | not mapped |
| Courses | `courses` | 1 | 1 | 0 | not mapped |
| Diagnostic Tools | `diagnostic-tools` | 521 | 521 | 8 | mapped |
| Services | `services` | 1531 | 1531 | 0 | not mapped |
| Cables & Adapters | `cables-adapters` | 1025 | 1025 | 2 | mapped |
| Key Programming | `key-programming` | 5928 | 5928 | 6 | mapped |
| ADAS Calibration | `adas-calibration` | 5 | 5 | 0 | not mapped |
| ECU Calibration & Tuning | `ecu-calibration-tuning` | 7 | 7 | 0 | not mapped |
| Module Programming | `module-programming` | 13 | 13 | 0 | not mapped |
| Online OEM Access Tokens | `online-oem-tokens` | 11 | 11 | 0 | not mapped |
| EEPROM & Data Services | `eeprom-data-services` | 6 | 6 | 0 | not mapped |
| Performance Upgrades | `performance-upgrades` | 11 | 11 | 0 | not mapped |
| Feature Coding | `feature-coding` | 5 | 5 | 0 | not mapped |

## Categories Not Mapped In New Seed

- `adas-calibration` (ADAS Calibration): 5 old products
- `courses` (Courses): 1 old products
- `ecu-calibration-tuning` (ECU Calibration & Tuning): 7 old products
- `eeprom-data-services` (EEPROM & Data Services): 6 old products
- `feature-coding` (Feature Coding): 5 old products
- `module-programming` (Module Programming): 13 old products
- `online-oem-tokens` (Online OEM Access Tokens): 11 old products
- `performance-upgrades` (Performance Upgrades): 11 old products
- `services` (Services): 1531 old products
- `tools` (Workshop Tools): 1 old products
- `tuning-tools` (Tuning Tools): 1387 old products

## Duplicate SKUs

- None found among non-empty SKUs.

## Missing Products

The full missing list is included in `full-shop-catalog.json` under `missingProducts`; first 250 are shown here.

| SKU | Slug | Name | Category | Price AED |
| --- | --- | --- | --- | ---: |
| `MK19314` | `1-year-update-service-subscription-for-bosscomm-kmax-850` | 1 Year Update Service Subscription for BossComm Kmax 850 | `services` | 1413.91 |
| `MKON208` | `10-token-for-yanhua-digimaster-iii-digi-master-3` | 10 Token for Yanhua DigiMaster III Digi Master 3 | `services` | 64.64 |
| `MKON45` | `1000-x-pin-for-flip-remote-key-blade-fix` | 1000 x Pin for Flip Remote Key Blade Fix | `key-programming` | 80.8 |
| `MK21671` | `2-end-mill-1-tracer-point-carbide-set-of-3-pcs--08-50--08-` | 2 End Mill & 1 Tracer Point Carbide Set Of 3 PCs ( φ0.8 - 50° - φ0.8 ) | `tuning-tools` | 121.19 |
| `MKON43` | `200-x-pin-for-flip-remote-key-blade-fix` | 200 x Pin for Flip Remote Key Blade Fix | `key-programming` | 18.18 |
| `MKON273` | `200x-rfid-125khz-fob-t5577-grey-handheld-duplicator` | 200x RFID 125KHz KEY FOB Proximity T5577 Grey Color & FREE Handheld Duplicator | `key-programming` | 323.18 |
| `MKON271` | `200x-rfid-125khz-fob-t5577-red-free-handheld-duplicator` | 200x RFID 125KHz KEY FOB Proximity T5577 RED Color & FREE Handheld Duplicator | `key-programming` | 323.18 |
| `MKON272` | `200x-rfid-125khz-fob-t5577-yellow-handheld-duplicator` | 200x RFID 125KHz KEY FOB Proximity T5577 Yellow Color & FREE Handheld Duplicator | `key-programming` | 323.18 |
| `MKON270` | `200x-rfid-125khz-key-fob-proximity-t5577-black-color-free-handheld-duplicator` | 200x RFID 125KHz KEY FOB Proximity T5577 Black Color & FREE Handheld Duplicator | `key-programming` | 323.18 |
| `MKON301` | `200x-rfid-125khz-key-fob-proximity-t5577-bundle` | 200x RFID 125KHz KEY FOB Proximity T5577 Bundle & FREE Handheld Duplicator | `key-programming` | 323.18 |
| `MK14636` | `48-transponder-for-gmc-chevrolet-hummer-h3` | 48 Transponder for GMC Chevrolet Hummer H3 | `key-programming` | 12.12 |
| `MK19204` | `4d-id60-texas-ti-glass-transponder` | Texas TI Original 4D ID60 Glass Type Transponder Chip For Ford Mazda Lincoln Jaguar | `key-programming` | 11.11 |
| `MK19234` | `4d-id67-texas-ti-carbon-transponder-for-toyota` | Texas TI Original 4D ID67 Carbon Type Transponder Chip for Toyota | `key-programming` | 9.7 |
| `MK19208` | `4e-id64-texas-ti-carbon-transponder-for-chrysler` | Texas 4E ID64 TI Carbon Transponder Chip for Chrysler Dodge Jeep | `key-programming` | 24.24 |
| `MKON44` | `500-x-pin-for-flip-remote-key-blade-fix` | 500 x Pin for Flip Remote Key Blade Fix | `key-programming` | 34.34 |
| `MK16750` | `6750-toyota-smart-key-4-buttons-312mhz-pcb-271451-6230` | Toyota Smart Key 4 Buttons Slider Door 312MHz PCB 271451-6230 | `key-programming` | 100.99 |
| `MK17712` | `900m-t-lead-free-solderin-iron-tip-set` | Bestool 900M-T LEAD FREE SOLDERIN IRON TIP SET | `tuning-tools` | 64.64 |
| `MK23465` | `abarth-fiat-ignition-lock-5-pin-51865543` | Abarth Grand Punto, Fiat Doblo, Grand Punto, Punto Ignition Lock 5 Pin - 51865543 | `tuning-tools` | 64.64 |
| `MK23546` | `abarth-fiat-ignition-starter-switch-51929109` | Abarth Grand Punto Fiat Doblo, Grand Punto, Punto Ignition Starter Switch 5 Pin - 51929109 | `tuning-tools` | 18.18 |
| `MK23466` | `abarth-grand-punto-fiat-doblo-grand-punto-ignition-lock` | Abarth Grand Punto Fiat Doblo, Grand Punto, Punto Ignition Lock 5 Pin | `tuning-tools` | 84.83 |
| `MK12870` | `abarth-smart-remote-key-315mhz-fcc-id-wazske13d01` | Fiat Abarth Smart Remote Key 4 Buttons 315Mhz FCC ID: WAZSKE13D01 | `key-programming` | 88.87 |
| `MK19661` | `abprog-eeprombcm-adapter-zn031` | Abrites ZN031 - ABPROG EEPROM/BCM adapter | `cables-adapters` | 469.74 |
| `MK19662` | `abrites-adapter-ir-reading-data-from-eis-zn036-zn045-zn033` | Abrites ZN036 - IR AVDI Cable Reading Data from EIS | `cables-adapters` | 282.7 |
| `MK19770` | `abrites-ams-annual-maintenance-subscription-renewed-within-its-60-days-of-expiration-date` | Abrites AMS-Annual Maintenance Subscription (Renewed Within 60 Days Of Expiration Date) | `services` | 1409.23 |
| `MK15856` | `abrites-atc01-device-bag-small-size` | Abrites ATC01 Tough Case - Small size | `tuning-tools` | 164.42 |
| `MK25271` | `abrites-atc06-abrites-tough-case-large-size` | Abrites ATC06 - Abrites Tough Case - Large size | `tuning-tools` | 446.27 |
| `MK25272` | `abrites-atc07-abrites-tough-case-small-size` | Abrites ATC07 - Abrites Tough Case - Small size | `tuning-tools` | 164.42 |
| `MK19673` | `abrites-avd-ta17-dst-electronic-key-head` | Abrites TA36 - Abrites DST 40bit/DST+ 80bit Electronic key head | `key-programming` | 140.91 |
| `MK19479` | `abrites-avdi-cb101-extension-cable-for-protag` | Abrites CB101 - AVDI Extension Cable for PROTAG | `cables-adapters` | 46.98 |
| `MK18004` | `abrites-bn00f-full-bmw-software-package-for-bmw-vehicles-bn012-bn016-bn017-bn018-bn020-` | Abrites BN00F - Full BMW Software Package for BMW vehicles (BN012, BN016, BN017, BN018, BN020, BN022) | `services` | 15501.37 |
| `MK24490` | `abrites-bn017-key-programming-chassis-and-ecu-adaptation-for-bmw-bikes` | Abrites BN017 - Key programming, Chassis, and ECU Adaptation for BMW Bikes | `key-programming` | 2113.84 |
| `MK24481` | `abrites-bn018-immo-parts-adaptation` | Abrites BN018 - Immo Parts Adaptation (including 8HP Gen3 virgin) | `services` | 3757.9 |
| `MK26279` | `abrites-bn020-key-programming-for-bmw-g-series-and-f-series-bdc2-vehicles` | Abrites BN020 - Key programming for BMW G-Series and F-Series BDC2 Vehicles | `key-programming` | 2818.41 |
| `MK27479` | `abrites-bn022-bdc2-replacement-and-mileage-reset-for-bmw` | Abrites BN022 - BDC2 Replacement and Mileage Reset for BMW Vehicles | `services` | 3757.9 |
| `MK27878` | `abrites-cable-set-for-tesla-model-sx-and-model-3` | Abrites Cable Set for Tesla Model S/X and Model 3 | `cables-adapters` | 469.74 |
| `MK19440` | `abrites-cb002-avdi-cable-for-20-pins-round-diagnostic-connector` | Abrites CB002 - AVDI cable for 20 pins round diagnostic connector for BMW | `cables-adapters` | 93.96 |
| `MK19441` | `abrites-cb003-avdi-cable-for-38-pins-round-diagnostic-connector` | Abrites CB003 - AVDI cable for 38 pins round diagnostic connector for MERCEDES | `cables-adapters` | 117.44 |
| `MK19670` | `abrites-cb006-avdi-cable-for-instrument-cluster-mercedes-w203-w209-w211-w219` | Abrites CB006 - AVDI cable for instrument cluster Mercedes W203, W209, W211, W219 | `cables-adapters` | 140.91 |
| `MK19435` | `abrites-cb007-avdi-cable-for-bombardier-diagnostic-connector` | Abrites CB007 - AVDI cable for Bombardier Diagnostic Connector | `cables-adapters` | 117.44 |
| `MK19434` | `abrites-cb008-avdi-cable-for-bmw-bike-diagnostic-connector` | Abrites CB008 - AVDI cable for BMW Bike Diagnostic Connector | `cables-adapters` | 258.34 |
| `MK19442` | `abrites-cb009-avdi-cable-for-connection` | Abrites CB009 - AVDI Cable for Connection with Trucks Deutsch 6 pin (J1708) | `cables-adapters` | 117.44 |
| `MK18120` | `abrites-cb010-cable` | Abrites CB019 Star Connector Cable for FCA | `cables-adapters` | 187.89 |
| `MK18119` | `abrites-cb011-cable` | Abrites CB011 - ABRITES Mercedes-Benz cable for EZS, 7G Tronic and ISM/DSM | `cables-adapters` | 469.74 |
| `MK18068` | `abrites-cb012-cable-set-for-direct-can-bus-connection` | ABRITES Cb012 - Abrites Cable Set For Direct Can-bus Connection | `cables-adapters` | 211.4 |
| `MK18060` | `abrites-cb013-ecu-bench-connection-cable-set` | Abrites CB013 - ECU Bench Connection Cable Set | `cables-adapters` | 140.91 |
| `MK13011` | `abrites-cb015-bmw-enet-cable` | Abrites CB015 BMW ENet Cable | `cables-adapters` | 117.44 |
| `MK23656` | `abrites-cb017-fca-all-keys-lost-cable` | Abrites CB017 - FCA All Keys Lost Cable | `key-programming` | 140.91 |
| `MK13012` | `abrites-cb021-renault-nissan-jumper-cable` | Abrites CB021 - Renault-Nissan Jumper Cable | `cables-adapters` | 258.34 |
| `MK13185` | `abrites-cb022-mercedes-actros-jumper-cable` | Abrites CB022 - Mercedes Actros Jumper Cable | `cables-adapters` | 258.34 |
| `MK23655` | `abrites-cb023-bmw-md-mg-ecu-connection-cable` | Abrites CB023 - BMW MD / MG ECU Connection Cable | `cables-adapters` | 516.72 |
| `MK23657` | `abrites-cb025-ds-box-relay-extension-cable` | Abrites CB025 - DS Box Relay Extension Cable | `cables-adapters` | 117.44 |
| `MK23658` | `abrites-cb027-tesla-model-3-diagnostic-cable` | Abrites CB027 - Tesla Model 3 Diagnostic Cable | `cables-adapters` | 234.87 |
| `MK23659` | `abrites-cb029-direct-can-connection-extension-cable` | Abrites CB029 - Direct CAN Connection Extension Cable | `cables-adapters` | 117.44 |
| `MK20190` | `abrites-cb030-mercedes-benz-md1mg1-ecu-connection-cable` | Abrites CB030 - Mercedes-Benz MD1/MG1 ECU connection Cable for FBS4 Manager and ECU Programming Tool | `cables-adapters` | 892.5 |
| `MK24921` | `abrites-cb031--xtension-cable-for-toyota-lexus` | Abrites CB031 - Еxtension Cable for Direct Connecting to Toyota / Lexus Smart System with B9 / BA | `cables-adapters` | 140.91 |
| `MK25138` | `abrites-cb032-dcm62-connection-cable` | Abrites CB032 - DCM6.2 Connection Cable | `cables-adapters` | 469.74 |
| `MK26298` | `abrites-cb033-ezs-bench-connection-cable-for-mercedes` | Abrites CB033 EZS Bench Connection Cable for Mercedes | `cables-adapters` | 187.89 |
| `MK26292` | `abrites-cb034-dsmism-direct-can-bus-connection-cable` | Abrites CB034 DSM/ISM Direct CAN BUS Connection Cable | `cables-adapters` | 140.91 |
| `MK26299` | `abrites-cb088-7g-tronic-direct-can-bus-connection-cable` | Abrites CB088 7G-Tronic VGS2/3/4-0 NAG2 FBS3 / FBS4 Direct CAN BUS Connection Cable | `cables-adapters` | 140.91 |
| `MK18965` | `abrites-cb100-avdi-obdii-cable-sae-j1962` | Abrites CB106 AVDI OBDII cable (SAE J1962) | `cables-adapters` | 140.91 |
| `MK19443` | `abrites-cb102-ext-cable-for-25-pin-fm` | Abrites CB102 - EXT Cable for 25 pin F/M | `cables-adapters` | 70.45 |
| `MK19444` | `abrites-cb103-obdii-y-cable-m2xf` | Abrites CB103 - OBDII Y cable M/2xF | `cables-adapters` | 93.96 |
| `MK13184` | `abrites-cb104-usb-a-b-cable` | Abrites CB104 - USB A-B Cable | `cables-adapters` | 70.45 |
| `MK19461` | `abrites-cb202-cable-for-connection-with-suzuki-marine-engines-type-2-round` | Abrites CB202 - AVDI cable for connection with Suzuki Marine Engines type 2 (round) | `cables-adapters` | 93.96 |
| `MK19447` | `abrites-cb205-evinrude-flash-update-cable` | Abrites CB205 - Evinrude Flash Update cable | `cables-adapters` | 93.96 |
| `MK19448` | `abrites-cb301-avdi-cable-for-connection-with-aprilia-bikes` | Abrites CB301 - AVDI cable for connection with Aprilia Bikes | `cables-adapters` | 164.42 |
| `MK19449` | `abrites-cb302-avdi-cable-for-connection-with-ktm-bikes` | Abrites CB302 - AVDI cable for connection with KTM Bikes | `cables-adapters` | 281.85 |
| `MK19450` | `abrites-cb303-avdi-cable-for-connection-with-benelli-bikes` | Abrites CB303 - AVDI cable for connection with Benelli Bikes | `cables-adapters` | 234.87 |
| `MK19451` | `abrites-cb304-avdi-cable-for-connection` | Abrites CB304 - AVDI cable for connection with Suzuki Bikes (6 pins) | `cables-adapters` | 258.34 |
| `MK18105` | `abrites-cb305-avdi-cable-for-connection-with-harley-davidson-bikes-cank-line` | Abrites CB305 - AVDI Cable for connection with Harley Davidson Bikes (CAN/K-Line) | `cables-adapters` | 281.85 |
| `MK19489` | `abrites-cb306-avdi-cable-for-connection-with-piaggio-bikes` | Abrites CB306 AVDI Cable For Connection With Piaggio Bikes | `cables-adapters` | 187.89 |
| `MK19666` | `abrites-cb401-cable-for-distribution-box-v23` | Abrites CB401 Cable for Distribution Box V2.3 | `cables-adapters` | 70.45 |
| `MK18117` | `abrites-cb402-ds-box-25-pin-cable` | Abrites CB402 Replacement 25 PIN Cable For Abrites ZN051 Distribution Box | `cables-adapters` | 70.45 |
| `MK23360` | `abrites-cb403-ds-box-extended-cable-set` | Abrites CB403 - DS-BOX Extended Cable Set For Direct Connection With Various Automotive / Truck Modules On Bench Work | `cables-adapters` | 375.78 |
| `MK23660` | `abrites-cb501-rh850-v850-connection-cable` | Abrites CB501 - RH850 / V850 Connection Cable | `cables-adapters` | 164.42 |
| `MK24698` | `abrites-cb603-truck-mcm-connection-cable` | Abrites CB603 - Truck MCM Connection Cable | `cables-adapters` | 469.74 |
| `MK24699` | `abrites-cb604-truck-tcu-connection-cable` | Abrites CB604 - Truck TCU Connection Cable | `cables-adapters` | 469.74 |
| `MK25719` | `abrites-complete-key-programming-bundle-for-renault-and-dacia-vehicles` | Abrites - Complete Key Programming Bundle for Renault and Dacia Vehicles | `key-programming` | 28179.6 |
| `MK18116` | `abrites-em008-odometer-calibration-emulator-for-w204-w205-w212-fbs3fbs4` | Abrites EM008 - Odometer calibration emulator for W204, W212, W205 (FBS3/FBS4) | `tuning-tools` | 375.78 |
| `MK18192` | `abrites-em010-ren-esl-emulator-with-clio-iv-connector` | Abrites EM010 - Renault ESL Emulator with Clio IV Type Connector | `cables-adapters` | 375.78 |
| `MK18193` | `abrites-em011-ren-esl-emulator-with-megane-ivtalisman-connector` | Abrites EM011 - Renault ESL Emulator with Megane IV/Talisman Type Connector | `cables-adapters` | 375.78 |
| `MK16685` | `abrites-em012-esl-emulator-for-benz-w204-w207-w21` | Abrites EM012 - ABRITES ESL Emulator for Mercedes-Benz W204/W207/W212 | `tuning-tools` | 234.87 |
| `MK16684` | `abrites-em014-odometer-calibration-emulator` | ABRITES EM014 - ODOMETER CALIBRATION EMULATOR For Mercedes-Benz W213 | `tuning-tools` | 375.78 |
| `MK18436` | `abrites-em015-jlr-ultra-wide-band-emulator` | ABRITES EM015 - JLR ULTRA WIDE BAND EMULATOR | `tuning-tools` | 375.78 |
| `MK20571` | `abrites-em018-odometer-calibration-with-jumper-cable` | Abrites EM018 Odometer Calibration With Jumper Cable For Dash W204 - W212 - W205 - FBS3 / FBS4 | `cables-adapters` | 446.27 |
| `MK26293` | `abrites-em019--mulator-for-ic223-ic177m-dashboards` | Abrites EM019 Еmulator for IC223 / IC177M Dashboards | `tuning-tools` | 187.89 |
| `MK13209` | `abrites-fn00f-fca-full-package-special-functions` | Abrites FN00f FCA Full Package Special Functions | `services` | 21138.23 |
| `MK18444` | `abrites-fn021fca-proxi-alignment` | Abrites FN021 FCA proxi alignment | `services` | 2348.71 |
| `MK17747` | `abrites-fn022-pin-and-key-manager-for-fca-vehicles` | Abrites FN022 - PIN And Key Manager For FCA Vehicles | `key-programming` | 7985.54 |
| `MK12318` | `abrites-fn023-vehicle-module-synchronization` | Abrites FN023 - Vehicle Module Synchronization | `services` | 9394.76 |
| `MK24010` | `abrites-fn024-key-learning-by-rh850-dump-for-fca` | Abrites FN024 - Key Learning by RH850 Dump for FCA Vehicles | `key-programming` | 2348.71 |
| `MK27309` | `abrites-fn025-key-programming-for-fca-vehicles` | Abrites FN025 - Key Programming for FCA Vehicles with HiTagAES Mechanical Keys by Dump | `key-programming` | 3757.9 |
| `MK13206` | `abrites-fr00f-full-ford-special-functions-set` | Abrites FR00F - Full Ford Special Functions Set ( FR010, FR011 ) | `services` | 4697.38 |
| `MK18188` | `abrites-fr010-pats-initialization-2014-fr008-is-required-software` | Abrites FR010 - PATS Initialization 2014+ | `services` | 3757.9 |
| `MK22635` | `abrites-fr011-key-learning-by-rh850-dump-for-ford` | Abrites FR011 - Key learning by RH850 dump for Ford vehicles (2021+) | `key-programming` | 1878.97 |
| `MKON477` | `abrites-full-abrites-renault-key-programming-software-bundle` | Abrites - Full ABRITES Renault / Dacia Key Programming Software Bundle | `key-programming` | 28597.67 |
| `MKON476` | `abrites-full-renault-dacia-software-bundle` | Abrites - Full Renault / Dacia Software Bundle | `services` | 35639.04 |
| `MK13212` | `abrites-hk00f-full-hyundai-kia-special-functions` | Abrites - HK00F HYUNDAI / KIA Full Package Special Functions | `services` | 7985.54 |
| `MK24885` | `abrites-hk013-cluster-calibration-for-kia-hyundai` | Abrites HK013 - Cluster Calibration for KIA / Hyundai Vehicles | `services` | 1878.97 |
| `MK16367` | `abrites-jl006-key-programming-for-my-2020-jlr-vehicles` | Abrites JL006 - Key programming for MY 2020+ JLR vehicles | `key-programming` | 3757.9 |
| `MK28235` | `abrites-jl007-alarm-off-for-jlr-models-2014-2024` | Abrites - JL007 - Alarm OFF for JLR Models 2014-2024 | `services` | 3288.15 |
| `MK28236` | `abrites-jlr00f-full-abrites-software-package-for-jlr-vehicles` | Abrites - JLR00F - Full ABRITES Software Package for JLR vehicles | `services` | 5167.12 |
| `MK16344` | `abrites-k011-abrites-pin-and-key-manager` | Abrites HK011 - Abrites PIN and Key manager | `key-programming` | 4697.38 |
| `MK18128` | `abrites-kp001-volvo-key-programmer` | Abrites KP001 Volvo Key Programmer | `key-programming` | 939.48 |
| `MK12317` | `abrites-kp002-jlr-akl-tool` | Abrites KP002 – JLR AKL TOOL | `cables-adapters` | 2348.71 |
| `MK28167` | `abrites-ml002-adi-instrument-cluster-and-display-configuration-for-mclaren-vehicles` | Abrites - ML002 ADI (Instrument Cluster and Display) Configuration for McLaren Vehicles | `services` | 4697.38 |
| `MK28333` | `abrites-ml003-key-programming-and-immo-parts-adaptation-for-mclaren-vehicles` | Abrites - ML003 Key Programming and Immo Parts Adaptation for McLaren Vehicles | `key-programming` | 7046.09 |
| `MK28334` | `abrites-ml00f-full-abrites-software-package-for-mclaren-vehicles` | Abrites - ML00F Full ABRITES Software Package for McLaren vehicles | `services` | 15501.37 |
| `MK13198` | `abrites-mn00f-full-mercedes-benz-special-functions-set-for-passenger-vehicles-mn030-mn032-mn033-mn034-mn037-mn038-mn039mn040-and-mn042` | Abrites MN00F Full Mercedes-Benz Special Functions Set for Passenger Vehicles MN030, MN032, MN033, MN034, MN037, MN038, MN039,MN040 and MN042 | `services` | 31002.74 |
| `MK17062` | `abrites-mn030-fbs4-instrument-cluster-calibration` | Abrites MN030 - FBS4 instrument cluster calibration for Mercedes | `services` | 3523.03 |
| `MK13995` | `abrites-mn031-das-manager-for-mercedes-benz-trucks` | Abrites MN031 - DAS Manager For Mercedes-Benz Trucks and Buses (incl. Setra) | `services` | 9394.76 |
| `MK18002` | `abrites-mn032-das-manager-mercedes` | Abrites MN032 - DAS Manager for FBS4 cars | `services` | 9394.76 |
| `MKON423` | `abrites-mn032-mn034-for-mercedes-benz-bundle` | Abrites MN032 + MN034 for Mercedes Benz Bundle | `services` | 15031.63 |
| `MK12588` | `abrites-mn033-mercedes-benz-fbs4-vehicles` | Abrites MN033 – Mercedes-Benz FBS4 Vehicles Electronic Steering Lock Repair | `services` | 2113.84 |
| `MK25256` | `abrites-mn037-cluster-calibration-ic177` | Abrites MN037 - Cluster Calibration IC177 | `services` | 3757.9 |
| `MK25339` | `abrites-mn038-cluster-calibration-ic223-2020-ic177-2023` | Abrites MN038 - Cluster Calibration IC223 2020 + IC177 2023+ (Visteon R7F701529 BGA) | `services` | 2818.41 |
| `MK27302` | `abrites-mn039-7g-vgs4-nag2-tcu-virgin-and-personalization-by-diagnostic-can` | Abrites MN039 - 7G (VGS4-NAG2) TCU Virgin and Personalization by Diagnostic CAN | `diagnostic-tools` | 4227.64 |
| `MK27531` | `abrites-mn040-tcu-personalization-without-fbs4-data` | Abrites MN040 - TCU Personalization Without FBS4 Data | `services` | 7046.09 |
| `MK16393` | `abrites-modi-mobile-diagnostics` | Abrites MODI Mobile Diagnostics | `cables-adapters` | 840.83 |
| `MK28233` | `abrites-nn00f-full-abrites-software-package-for-nissan-vehicles` | Abrites NN00F - Full ABRITES Software Package for Nissan vehicles | `services` | 7985.54 |
| `MK20449` | `abrites-nn010-nissan-all-keys-lost-from-rh850-dump` | Abrites - NN010 Nissan All Keys Lost From RH850 Dump | `key-programming` | 1409.23 |
| `MK28232` | `abrites-nn011-dashb-d0-beard-calibration-for-new-nissan-vehicles` | Abrites NN011 - Dashbоard Calibration For New Nissan Vehicles | `services` | 3757.9 |
| `MK13211` | `abrites-on00f-full-gm-special-functions` | Abrites ON00F - GM Full Package Special Functions ( ON013 and ON14 ) | `services` | 4697.38 |
| `MK13200` | `abrites-pn00f-full-psa-special-functions-set` | Abrites PN00F - Full PSA (Peugeot, Citroen) Special Functions Set PN009, PN017, PN019, PN020 and PN021 | `services` | 16440.85 |
| `MK18025` | `abrites-pn017-bsi-instrument-cluster-data-manager-software` | Abrites PN017-BSI Instrument Cluster Data Manager (Software) | `services` | 6482.38 |
| `MK18026` | `abrites-pn018-pin-mager-software` | Abrites PN018 - PIN Manager | `services` | 6482.38 |
| `MK18196` | `abrites-pn019-advanced-coding-configuration` | Abrites PN019 - Advanced Coding Configuration | `services` | 1878.97 |
| `MK27547` | `abrites-pn020-pin-manager-bsi-and-engine-control-unit` | Abrites PN020 - PIN Manager (BSI and Engine Control Unit) | `services` | 8455.28 |
| `MK27551` | `abrites-pn021-instrument-cluster-data-manager-ic-bsi-bccm-vsm` | Abrites PN021 - Instrument Cluster Data Manager (IC, BSI, BCCM, VSM) | `services` | 8455.28 |
| `MK12913` | `abrites-po00f-full-abrites-software-package-for-porsche-vehicles` | Abrites PO00F - Full ABRITES Software Package for Porsche vehicles | `services` | 6341.48 |
| `MK19658` | `abrites-ren-esl-emulator-em002` | Abrites EM002 - ABRITES ESL Emulator for Renault | `tuning-tools` | 258.34 |
| `MK22639` | `abrites-renault-full-software-pack` | Abrites RR00F - Full Software Package for Renault / Dacia vehicles | `services` | 28179.6 |
| `MK18072` | `abrites-rr018-key-programming-for-ren-talisman-megane-iv-scenic-iv-espacev-software` | Abrites RR018 - Key programming for Renault Talisman/Megane IV/Scenic IV/Espace V and Clio IV/Megane III 2015+ | `key-programming` | 7515.83 |
| `MK18005` | `abrites-rr019-all-keys-lost-key-programming-for-twingo-iiismart-453-software` | Abrites RR019 - All Keys Lost Key Learning for Renault Twingo III and Smart 453 Vehicles | `key-programming` | 3757.9 |
| `MK18191` | `abrites-rr021-key-programming-for-ren-master-iii-and-kangoo-ii-special-function-software-activation` | Abrites RR021 - Key programming for Renault Master III and Kangoo II | `key-programming` | 1878.97 |
| `MK18194` | `abrites-rr022-software-activation` | Abrites RR022 - Key programming for Renault Clio V/Captur II | `services` | 1878.97 |
| `MK18022` | `abrites-rr024-module-renewal` | Abrites RR024 - Module Renewal | `services` | 2818.41 |
| `MK17800` | `abrites-rr026-renault-all-keys-lost-from-rh850-dump` | Abrites RR026 - Renault All Keys Lost from RH850 dump | `key-programming` | 1878.97 |
| `MK22637` | `abrites-rr027-all-keys-lost-situations-dacia` | Abrites RR027 - Key learning for Dacia 2020+ vehicles | `key-programming` | 5167.12 |
| `MK25723` | `abrites-rr030-dashboard-calibration-in-ic-and-abs-ate` | Abrites-RR030 Dashboard Calibration in IC and ABS (ATE) Modules for Renault and Dacia vehicles 2022+ | `services` | 6106.61 |
| `MK22640` | `abrites-sb002-key-learning-for-subaru-vehicles-2021` | Abrites - SB002 - Key Learning For Subaru Vehicles 2021+ | `key-programming` | 2583.54 |
| `MK25250` | `abrites-sb003-key-programming-by-rh850` | Abrites SB003 - Key Programming By RH850 Dump and ESL Reset / Synchronization | `key-programming` | 1878.97 |
| `MK25105` | `abrites-set088-7g-tronic-vgs4-nag2-fbs4-connection-set` | Abrites SET088 - 7G-Tronic VGS4-0 NAG2 FBS4 Solder-Free Connection Set | `cables-adapters` | 1409.23 |
| `MK24919` | `abrites-set307-direct-can-bus-connection-for-bmw-bikes` | Abrites SET307 – Direct CAN-BUS Connection Set for BMW Bikes | `cables-adapters` | 469.74 |
| `MK18139` | `abrites-software-update-from-bn002-bn003-bn004-bn006-to-bn010` | Abrites Software Update From BN002+BN003+BN004+BN006 to BN013 | `services` | 1409.23 |
| `MK18136` | `abrites-software-update-from-bn002-to-bn010` | Abrites Software Update From BN002 To BN013 | `services` | 3757.9 |
| `MK18137` | `abrites-software-update-from-bn002bn003-to-bn010` | Abrites Software Update From BN002 + BN003 to BN013 | `services` | 3288.15 |
| `MK13217` | `abrites-software-update-from-bn006-bn008-to-bn013` | Abrites Software Update From BN006+ BN008 to BN013 | `services` | 1878.97 |
| `MK13218` | `abrites-software-update-from-bn006-bn008-to-bn014` | Abrites Software Update From BN006+ BN008 to BN014 | `services` | 2113.84 |
| `MK18140` | `abrites-software-update-from-bn006-to-bn010` | Abrites Software Update From BN006 to BN013 | `services` | 2113.84 |
| `MK13166` | `abrites-software-update-from-bn010-to-bn013` | Abrites Software Update From BN010 to BN013 | `services` | 1878.97 |
| `MK13219` | `abrites-software-update-from-bn014-to-bn013` | Abrites Software Update From BN014 to BN013 | `services` | 1878.97 |
| `MK18150` | `abrites-software-update-from-cr005-to-fn019` | Abrites Software Update From CR005 to FN022 | `services` | 2818.41 |
| `MK13222` | `abrites-software-update-from-ep002-to-ep005` | Abrites Software Update From EP002 to EP005 | `services` | 1409.23 |
| `MK18149` | `abrites-software-update-from-fn016-cr005-to-fn019` | Abrites Software Update From FN016+CR005 to FN022 | `services` | 3523.03 |
| `MK18147` | `abrites-software-update-from-fn016-to-fn019` | Abrites Software Update From FN016 to FN022 | `services` | 3170.72 |
| `MK18148` | `abrites-software-update-from-fn017-to-fn019` | Abrites Software Update From FN017 to FN022 | `services` | 2113.84 |
| `MK18135` | `abrites-software-update-from-fn018-to-fn019` | Abrites Software Update from FN018 to FN022 | `services` | 1761.53 |
| `MK17054` | `abrites-software-update-from-fn019-to-fn022` | Abrites Software Update from FN019 to FN022 | `services` | 1056.92 |
| `MK18152` | `abrites-software-update-from-fr004-to-fr008` | Abrites Software Update From FR004 to FR008 | `services` | 1409.23 |
| `MK18153` | `abrites-software-update-from-fr006-to-fr008` | Abrites Software Update From FR006 to FR008 | `services` | 1409.23 |
| `MK17078` | `abrites-software-update-from-hk006-to-hk011` | Abrites Software Update from HK006 to HK011 | `services` | 3053.28 |
| `MK17077` | `abrites-software-update-from-hk008-to-hk011` | Abrites Software Update from HK008 to HK011 | `services` | 1409.23 |
| `MK13029` | `abrites-software-update-from-mn022-mn024-or-mn025-to-mn032` | Abrites Software Update from MN022 + MN024 or MN025 to MN032 | `services` | 6106.61 |
| `MK13028` | `abrites-software-update-from-mn022-mn23-to-mn032` | Abrites Software Update from MN022 + MN23 to MN032 | `services` | 4697.38 |
| `MK13025` | `abrites-software-update-from-mn022-to-mn032` | Abrites Software Update from MN022 to MN032 | `services` | 7985.54 |
| `MK13033` | `abrites-software-update-from-mn023-mn024-or-mn025-to-mn032` | Abrites Software Update from MN023 + MN024 or MN025 to MN032 | `services` | 6106.61 |
| `MK13026` | `abrites-software-update-from-mn023-to-mn032` | Abrites Software Update from MN023 to MN032 | `services` | 6106.61 |
| `MK13027` | `abrites-software-update-from-mn024-or-mn025-to-mn032` | Abrites Software Update from MN024 or MN025 to MN032 | `services` | 7985.54 |
| `MK18088` | `abrites-software-update-from-mn026-to-mn032` | Abrites Software Update From MN026 to MN032 | `services` | 2348.71 |
| `MK18089` | `abrites-software-update-from-mn027-to-mn032` | Abrites Software Update from MN027 to MN032 | `services` | 3757.9 |
| `MK18160` | `abrites-software-update-from-nn005-nn006-to-nn009` | Abrites Software Update from NN005 + NN006 to NN009 | `services` | 3288.15 |
| `MK18043` | `abrites-software-update-from-nn007-to-nn009` | Abrites Software Update from NN007 to NN009 | `services` | 2348.71 |
| `MK18176` | `abrites-software-update-from-nn008-to-nn009` | Abrites Software Update from NN008 to NN009 | `services` | 939.48 |
| `MK18165` | `abrites-software-update-from-pn006-to-pn009` | Abrites Software Update From PN006 to PN009 | `services` | 681.1 |
| `MK18166` | `abrites-software-update-from-pn008-to-pn009` | Abrites Software Update From PN008 to PN009 | `services` | 469.74 |
| `MK18170` | `abrites-software-update-from-pn010-to-pn018` | Abrites Software Update From PN010 to PN018 | `services` | 3288.15 |
| `MK18167` | `abrites-software-update-from-pn011-to-pn017` | Abrites Software Update From PN011 to PN017 | `services` | 3288.15 |
| `MK18171` | `abrites-software-update-from-pn012-or-pn014-to-pn018` | Abrites Software Update From PN012 or PN014 to PN018 | `services` | 2113.84 |
| `MK18168` | `abrites-software-update-from-pn013-to-pn017` | Abrites Software Update From PN013 to PN017 | `services` | 2113.84 |
| `MK18169` | `abrites-software-update-from-pn015-to-pn017` | Abrites Software Update From PN015 to PN017 | `services` | 1550.13 |
| `MK18172` | `abrites-software-update-from-pn016-to-pn018` | Abrites Software Update From PN016 to PN018 | `services` | 1550.13 |
| `MK18173` | `abrites-software-update-from-po003-to-po008` | Abrites Software Update From PO003 to PO008 | `services` | 1878.97 |
| `MK18179` | `abrites-software-update-from-rr017-to-rr018` | Abrites Software Update From RR017 to RR018 | `services` | 1644.1 |
| `MK23304` | `abrites-software-update-from-sb001-to-sb002` | Abrites Software Update From SB001 to SB002 | `services` | 1409.23 |
| `MK17768` | `abrites-software-update-from-tn012-to-tn015` | Abrites - Software Update From TN012 To TN015 | `services` | 1409.23 |
| `MK18184` | `abrites-software-update-from-vn001-to-vn015` | Abrites Software Update From VN001 to VN015 | `services` | 1878.97 |
| `MK18183` | `abrites-software-update-from-vn008-to-vn009` | Abrites Software Update From VN008 to VN009 | `services` | 939.48 |
| `MK18185` | `abrites-software-update-from-vn010-to-vn015` | Abrites Software Update From VN010 to VN015 | `services` | 2207.76 |
| `MK15882` | `abrites-subaru-dst-aes-emulator-ta41` | Abrites TA41 - Subaru DST-AES Emulator | `tuning-tools` | 234.87 |
| `MK25255` | `abrites-subaru-full-software-package` | Abrites - Subaru Full Software Package | `services` | 3757.9 |
| `MK24487` | `abrites-sw-update-from-bn002-bn003-bn004-bn006-to-bn016` | Abrites - SW Update from BN002 + BN003 + BN004 + BN006 to BN016 | `services` | 3288.15 |
| `MK24486` | `abrites-sw-update-from-bn006-bn008-to-bn016` | Abrites - SW Update from BN006 + BN008 to BN016 | `services` | 3288.15 |
| `MK22633` | `abrites-sw-update-from-bn006bn008-to-bn015` | Abrites - SW Update from BN006+BN008 to BN015 | `services` | 3523.03 |
| `MK22634` | `abrites-sw-update-from-bn010-to-bn015` | Abrites - SW Update from BN010 to BN015 | `services` | 3523.03 |
| `MK24484` | `abrites-sw-update-from-bn010-to-bn016` | Abrites - SW Update from BN010 to BN016 | `services` | 3288.15 |
| `MK24482` | `abrites-sw-update-from-bn011-to-bn018` | Abrites - SW Update from BN011 to BN018 | `services` | 1409.23 |
| `MK24488` | `abrites-sw-update-from-bn013-to-bn016` | Abrites - SW Update from BN013 to BN016 | `services` | 1878.97 |
| `MK24491` | `abrites-sw-update-from-bn013-to-bn017` | Abrites - SW Update from BN013 to BN017 | `services` | 1409.23 |
| `MK22632` | `abrites-sw-update-from-bn014-to-bn015` | Abrites - SW Update from BN014 to BN015 | `services` | 1409.23 |
| `MK24485` | `abrites-sw-update-from-bn014-to-bn016` | Abrites - SW Update from BN014 to BN016 | `services` | 3288.15 |
| `MK24489` | `abrites-sw-update-from-bn015-to-bn016` | Abrites - SW Update from BN015 to BN016 | `services` | 1878.97 |
| `MK23873` | `abrites-sw-update-from-mn022-mn023-mn024-to-mn032-mn034` | Abrites - SW Update from MN022, MN023, MN024 to MN032 + MN034 | `services` | 7985.54 |
| `MK23874` | `abrites-sw-update-from-mn022-mn023-mn025-to-mn032-mn034` | Abrites - SW Update from MN022, MN023, MN025 to MN032 + MN034 | `services` | 7985.54 |
| `MK23876` | `abrites-sw-update-from-mn022-mn023-to-mn032-mn034` | Abrites - SW Update from MN022, MN023 to MN032 + MN034 | `services` | 10334.25 |
| `MK23878` | `abrites-sw-update-from-mn022-mn024-to-mn032-mn034` | Abrites - SW Update from MN022, MN024 to MN032 + MN034 | `services` | 11743.47 |
| `MK23879` | `abrites-sw-update-from-mn022-mn025-to-mn032-mn034` | Abrites - SW Update from MN022, MN025 to MN032 + MN034 | `services` | 11743.47 |
| `MK23883` | `abrites-sw-update-from-mn022-to-mn032-mn034` | Abrites - SW Update from MN022 to MN032 + MN034 | `services` | 13622.4 |
| `MK23881` | `abrites-sw-update-from-mn023-mn024-to-mn032-mn034` | Abrites - SW Update from MN023, MN024 to MN032 + MN034 | `services` | 11743.47 |
| `MK23880` | `abrites-sw-update-from-mn023-to-mn032-mn034` | Abrites - SW Update from MN023 to MN032 + MN034 | `services` | 11743.47 |
| `MK23884` | `abrites-sw-update-from-mn024-to-mn032-mn034` | Abrites - SW Update from MN024 to MN032 + MN034 | `services` | 13622.4 |
| `MK23885` | `abrites-sw-update-from-mn025-to-mn032-mn034` | Abrites - SW Update from MN025 to MN032 + MN034 | `services` | 13622.4 |
| `MK23875` | `abrites-sw-update-from-mn026-to-mn032-mn034` | Abrites - SW Update from MN026 to MN032 + MN034 | `services` | 7985.54 |
| `MK23877` | `abrites-sw-update-from-mn027-to-mn032-mn034` | Abrites - SW Update from MN027 to MN032 + MN034 | `services` | 10334.25 |
| `MK22638` | `abrites-sw-update-from-rr023-to-rr027` | Abrites - SW Update From RR023 to RR027 | `services` | 2348.71 |
| `MK24894` | `abrites-sw-update-from-tn009-to-tn017` | Abrites - SW update from TN009 to TN017 | `services` | 1174.36 |
| `MK15871` | `abrites-ta14-key-for-all-types-mercedes-with-ir-frequency-433mhz` | Abrites Ta14 - Abrites Key For All Types Mercedes With IR. Frequency 433MHz | `key-programming` | 140.91 |
| `MK18993` | `abrites-ta15-key-for-all-types-mercedes-with-ir-frequency-315mhz` | Abrites Ta15 - Abrites Key For All Types Mercedes With IR. Frequency 315MHz | `key-programming` | 140.91 |
| `MK18992` | `abrites-ta22-pcb-for-mercedes-ir-key-fob-case-small-size-3-button-315mhz` | Abrites TA22 PCB for Mercedes IR Key Fob Case Small Size 3 Button 315MHz | `key-programming` | 117.44 |
| `MK18984` | `abrites-ta24-chrysler-dodge-jeep-2013-remote-key` | Abrites TA24 - Abrites Chrysler Dodge Jeep 2013+ Key | `key-programming` | 234.87 |
| `MK18814` | `abrites-ta28-avdi-clio-4-captur-keyless-key-pcb` | Abrites TA28 - Clio 4 / Captur KEYLESS key PCB | `key-programming` | 164.42 |
| `MK18985` | `abrites-ta29-fiat-500x-key-less-key` | Abrites TA29 FIAT 500X Keyless key | `key-programming` | 234.87 |
| `MK19465` | `abrites-ta31-extractor` | Abrites TA31 Extractor Hyundai & Kia Pin code and 7th Component Protection byte from VAG vehicles | `tuning-tools` | 117.44 |
| `MK18129` | `abrites-ta44-audi-bcm2-pcb-for-original-key-shell-868-mhz` | Abrites TA44 Audi BCM2 Original PCB 868 MHz | `key-programming` | 234.87 |
| `MK18130` | `abrites-ta46-audi-bcm2-pcb-for-original-key-shell-433-mhz` | Abrites TA46 Audi BCM2 Original PCB With Key Shell 433 MHz | `key-programming` | 234.87 |
| `MK18131` | `abrites-ta47-audi-bcm2-pcb-for-original-key-shell-315-mhz` | Abrites TA47 Audi BCM2 Original PCB With Key Shell 315 MHz | `key-programming` | 234.87 |
| `MK18123` | `abrites-ta48-keyless-key-for-audi-bcm2-vehicles-868-mhz` | Abrites TA48 - Audi BCM2 Keyless Original PCB With Key Shell 868MHz | `key-programming` | 563.67 |
| `MK18122` | `abrites-ta49-keyless-key-for-audi-bcm2-vehicles-433-mhz` | Abrites TA49 Keyless Key For Audi BCM2 Vehicles 433 MHz | `key-programming` | 563.67 |
| `MK18121` | `abrites-ta50-keyless-key-for-audi-bcm2-vehicles-315-mhz` | Abrites TA50 Keyless Key For Audi BCM2 Vehicles 315MHz | `key-programming` | 563.67 |
| `MK18124` | `abrites-ta51-megamos-aes-emulator` | Abrites TA51 Megamos AES Emulator | `tuning-tools` | 117.44 |
| `MK18127` | `abrites-ta52-universal-bga-mercedes-benz-key-433315-mhz-with-shell` | Abrites TA52 Universal BGA Mercedes-Benz key (433/315 MHz) with Shell | `key-programming` | 234.87 |
| `MK18118` | `abrites-ta54-key-for-jlr` | Abrites TA54 - Abrites key for JLR 2010-2018 (433MHz) | `key-programming` | 704.61 |
| `MK18062` | `abrites-ta56-key-for-jlr-315mhz` | Abrites TA56 - Abrites Key for JLR 2010-2018 (315Mhz) | `key-programming` | 704.61 |
| `MK18435` | `abrites-ta64-abrites-hitag-aes-emulator` | ABRITES TA64 - ABRITES HITAG-AES Emulator | `tuning-tools` | 234.87 |
| `MK17678` | `abrites-ta65-ren-clio-v-keyless-key-card` | Abrites TA65 REN Clio V Keyless Key Card | `key-programming` | 234.87 |
| `MK13313` | `abrites-ta66-key-for-2018-jlr-vehicles-433-mhz` | Abrites TA66 Key for 2018+ JLR vehicles 433MHz | `key-programming` | 704.61 |
| `MK17672` | `abrites-ta67-jlr-key-for-2020-vehicles-315-mhz` | Abrites TA67 -JLR Key For 2018 + Vehicles 315 MHz | `key-programming` | 704.61 |
| `MK18976` | `abrites-ta68-avd-dst-aes-transponder-emulator` | Abrites TA68 AVD DST AES Transponder Emulator For Toyota & Subaru | `key-programming` | 140.91 |
| `MK14231` | `abrites-ta69-infra-red-key-for-mercedes-benz-trucks` | Abrites ТA69 Infra Red Key For Actros Mercedes Benz Trucks | `key-programming` | 610.65 |
| `MK27472` | `abrites-ta70-key-for-fca-vehicles-atmel-type` | Abrites TA70 - Key for FCA vehicles (Atmel-type) | `key-programming` | 704.61 |
| `MK18104` | `abrites-ta9-bcm2-remote-key-868mhz` | Abrites TA9 - BCM2 Remote Key 868MHz | `key-programming` | 187.89 |
| `MK13208` | `abrites-tn00f-full-toyota-special-functions-set` | Abrites TN00F - Toyota Full Package ( TN0014, TN015, TN016, TN017 and TN019 ) | `services` | 14092.14 |
| `MK17764` | `abrites-tn014-key-programming-for-toyota` | Abrites TN014 - Key programming for 2020+ Toyota vehicles (BA HT-AES) | `key-programming` | 4462.51 |
| `MK17765` | `abrites-tn015-key-programming-for-2020-toyota` | Abrites TN015 - Key Programming for 2020+ Toyota vehicles (BA DST-AES) | `key-programming` | 4462.51 |
| `MK22411` | `abrites-tn016-key-programming-2022-lexus-vehicles` | Abrites TN016 - Key programming 2022+ Lexus vehicles (B9 DST-AES key) | `key-programming` | 4462.51 |
| `MK24884` | `abrites-tn017-id-code-box-reset-and-adaptation-for-toyota` | Abrites TN017 - ID-Code-Box Reset and Adaptation for Toyota and Lexus Vehicles ( Until 2024 ) | `services` | 2818.41 |
| `MK25123` | `abrites-tn019-dashboard-calibration-for-toyota-and-lexus` | Abrites TN019 - Dashboard Calibration for Toyota and Lexus Vehicles with S6J3 by OBDII or Direct CAN Bus Connection | `services` | 3288.15 |
| `MK25290` | `abrites-tn020-dashboard-calibration-for-toyota` | Abrites TN020 - Dashboard Calibration for Toyota and Lexus Vehicles with RH850 by Direct CAN Bus Connection (Denso) | `services` | 2818.41 |
| `MK19672` | `abrites-tough-case-large-size` | Abrites New ATC03 Tough Case - Large Size | `tuning-tools` | 563.67 |
| `MK19656` | `abrites-toyota-transponder-emulator-zn039` | Abrites ZN039-2 - Toyota Transponder Emulator | `key-programming` | 469.74 |
