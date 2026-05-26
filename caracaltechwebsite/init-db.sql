-- Initialize CaracalTech ECU Intelligence Platform Database

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set default role
ALTER ROLE caracaltech SET search_path TO public;

-- Create initial source records for data tracking
INSERT INTO sources (id, name, url, type, credibility_score, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'KESS3 Official', 'https://kess3.com', 'official', 95, now(), now()),
  (gen_random_uuid(), 'Autotuner Official', 'https://autotuner.com', 'official', 90, now(), now()),
  (gen_random_uuid(), 'Magic Motorsport', 'https://magicmotor.com', 'official', 85, now(), now()),
  (gen_random_uuid(), 'PCMFlash', 'https://pcmflash.ru', 'official', 85, now(), now()),
  (gen_random_uuid(), 'WinOLS', 'https://winols.com', 'official', 80, now(), now()),
  (gen_random_uuid(), 'CMD', 'https://cmdtool.com', 'official', 75, now(), now()),
  (gen_random_uuid(), 'Community Consensus', NULL, 'community', 50, now(), now()),
  (gen_random_uuid(), 'Internal Verification', NULL, 'academic', 65, now(), now()),
  (gen_random_uuid(), 'Test Data', NULL, 'test', 0, now(), now())
ON CONFLICT (name) DO NOTHING;

-- Create initial tuning tools
INSERT INTO tuning_tools (id, name, tool_code, description, manufacturer, website, supports_boot_mode, supports_bench_mode, supports_obd2, supports_jtag, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'KESS3', 'KESS3', 'KESS 3 ECU Programmer', 'Alientech', 'https://kess3.com', true, true, true, false, now(), now()),
  (gen_random_uuid(), 'Autotuner', 'AUTOTUNER', 'Autotuner Pro Ecosystem', 'Autotuner', 'https://autotuner.com', true, true, true, false, now(), now()),
  (gen_random_uuid(), 'Magic Motorsport', 'MAGICMOTOR', 'Magic Motorsport Tuning Platform', 'Magic Motorsport', 'https://magicmotor.com', true, true, true, false, now(), now()),
  (gen_random_uuid(), 'PCMFlash', 'PCMFLASH', 'PCMFlash ECU Programming Tool', 'PCMFlash', 'https://pcmflash.ru', true, true, false, true, now(), now()),
  (gen_random_uuid(), 'WinOLS', 'WINOLS', 'WinOLS ECU Tuning Software', 'EVC', 'https://winols.com', true, false, false, false, now(), now()),
  (gen_random_uuid(), 'CMD', 'CMD', 'CMD ECU Tool', 'CMD', 'https://cmdtool.com', true, true, false, false, now(), now())
ON CONFLICT (tool_code) DO NOTHING;

-- Create initial protocol definitions
INSERT INTO protocol_definitions (id, protocol_name, protocol_code, protocol_category, default_baud_rate, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'OBD2 K-Line', 'OBD2_KLINE', 'diagnostic', 10400, 'OBD2 diagnostic protocol via K-Line (ISO 9141)', now(), now()),
  (gen_random_uuid(), 'KWP2000', 'KWP2000', 'diagnostic', 10400, 'Keyword Protocol 2000 for ECU diagnostics', now(), now()),
  (gen_random_uuid(), 'UDS (ISO 14229)', 'UDS', 'diagnostic', 115200, 'Unified Diagnostic Services ISO 14229', now(), now()),
  (gen_random_uuid(), 'JTAG', 'JTAG', 'jtag', NULL, 'JTAG interface for low-level ECU access', now(), now()),
  (gen_random_uuid(), 'SPI', 'SPI', 'spi', NULL, 'Serial Peripheral Interface for flash memory access', now(), now()),
  (gen_random_uuid(), 'CAN', 'CAN', 'can', 500000, 'Controller Area Network for vehicle communication', now(), now()),
  (gen_random_uuid(), 'LIN', 'LIN', 'lin', 19200, 'Local Interconnect Network for body control', now(), now())
ON CONFLICT (protocol_code) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles(make, model);
CREATE INDEX IF NOT EXISTS idx_vehicles_year_range ON vehicles(year_start, year_end);
CREATE INDEX IF NOT EXISTS idx_engines_vehicle_id ON engines(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_engines_fuel_type ON engines(fuel_type);
CREATE INDEX IF NOT EXISTS idx_ecu_families_code ON ecu_families(family_code);
CREATE INDEX IF NOT EXISTS idx_ecu_models_family_id ON ecu_models(ecu_family_id);
CREATE INDEX IF NOT EXISTS idx_ecu_models_code ON ecu_models(model_code);
CREATE INDEX IF NOT EXISTS idx_ecu_part_numbers_model_id ON ecu_part_numbers(ecu_model_id);
CREATE INDEX IF NOT EXISTS idx_ecu_part_numbers_part_number ON ecu_part_numbers(part_number);
CREATE INDEX IF NOT EXISTS idx_vehicle_ecu_apps_vehicle ON vehicle_ecu_applications(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_ecu_apps_ecu ON vehicle_ecu_applications(ecu_model_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_ecu_apps_confidence ON vehicle_ecu_applications(confidence_score);
CREATE INDEX IF NOT EXISTS idx_tool_ecu_methods_tool ON tool_ecu_methods(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_ecu_methods_ecu ON tool_ecu_methods(ecu_model_id);
CREATE INDEX IF NOT EXISTS idx_tool_ecu_methods_status ON tool_ecu_methods(support_status);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_record_sources_record ON record_sources(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_record_sources_source ON record_sources(source_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_import_batches_status ON import_batches(batch_status);
CREATE INDEX IF NOT EXISTS idx_import_staging_batch ON import_staging(import_batch_id, validation_status);
CREATE INDEX IF NOT EXISTS idx_search_aliases_term ON search_aliases(primary_term, alias_term);

-- Create view for quick vehicle-ECU lookup
CREATE OR REPLACE VIEW vehicle_ecu_compatibility AS
SELECT
  v.id as vehicle_id,
  v.make,
  v.model,
  v.year_start,
  v.year_end,
  e.id as engine_id,
  e.engine_code,
  e.displacement_cc,
  e.fuel_type,
  vea.id as application_id,
  vea.region,
  em.id as ecu_model_id,
  ef.family_code,
  em.model_code,
  vea.confidence_score,
  vea.verified_by_admin,
  COUNT(DISTINCT tem.id) as compatible_tools
FROM vehicles v
LEFT JOIN engines e ON v.id = e.vehicle_id
LEFT JOIN vehicle_ecu_applications vea ON v.id = vea.vehicle_id AND e.id = vea.engine_id
LEFT JOIN ecu_models em ON vea.ecu_model_id = em.id
LEFT JOIN ecu_families ef ON em.ecu_family_id = ef.id
LEFT JOIN tool_ecu_methods tem ON em.id = tem.ecu_model_id AND tem.support_status != 'unsupported'
WHERE v.is_active = true
GROUP BY v.id, v.make, v.model, v.year_start, v.year_end,
         e.id, e.engine_code, e.displacement_cc, e.fuel_type,
         vea.id, vea.region, em.id, ef.family_code, em.model_code,
         vea.confidence_score, vea.verified_by_admin;

-- Create view for tool compatibility matrix
CREATE OR REPLACE VIEW tool_compatibility_matrix AS
SELECT
  t.id as tool_id,
  t.name as tool_name,
  t.tool_code,
  ef.id as family_id,
  ef.family_code,
  em.id as model_id,
  em.model_code,
  COUNT(DISTINCT tem.id) as method_count,
  MAX(CASE WHEN tem.support_status = 'full' THEN 1 ELSE 0 END) as has_full_support,
  MAX(CASE WHEN tem.support_status = 'partial' THEN 1 ELSE 0 END) as has_partial_support,
  AVG(tem.confidence_score) as avg_confidence
FROM tuning_tools t
LEFT JOIN tool_ecu_methods tem ON t.id = tem.tool_id
LEFT JOIN ecu_models em ON tem.ecu_model_id = em.id
LEFT JOIN ecu_families ef ON em.ecu_family_id = ef.id
WHERE t.is_active = true
GROUP BY t.id, t.name, t.tool_code, ef.id, ef.family_code, em.id, em.model_code;

-- Create function for confidence score calculation
CREATE OR REPLACE FUNCTION calculate_confidence_score(
  source_credibility INTEGER,
  evidence_type_weight INTEGER,
  verification_count INTEGER,
  admin_verified BOOLEAN
)
RETURNS INTEGER AS $$
DECLARE
  score DECIMAL := 0;
BEGIN
  -- Source credibility: 0-40 points
  score := score + (source_credibility::DECIMAL / 100.0 * 40);

  -- Evidence type: 0-35 points
  score := score + (evidence_type_weight::DECIMAL / 100.0 * 35);

  -- Verification count: 0-15 points
  score := score + LEAST(verification_count * 5, 15);

  -- Admin verification: +10 points
  IF admin_verified THEN
    score := score + 10;
  END IF;

  -- Cap at 100
  RETURN LEAST(ROUND(score)::INTEGER, 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO caracaltech;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO caracaltech;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO caracaltech;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO caracaltech;

-- Log initialization complete
SELECT 'CaracalTech ECU Intelligence Platform - Database initialized successfully' as status;
