-- ============================================================
-- Migration 005: REMOVE MANUFACTURING MODULE + ITS DATA
-- Run on Supabase SQL Editor (project rajnrkgcisgpxtzzfmcl).
--
-- The user-facing Manufacturing module was removed from the ERP.
-- This migration:
--   1) Drops the manufacturing tables (safe drop, existence-guarded).
--   2) Clears manufacturing keys out of the erp_state JSON bundle so the
--      system is clean and ready for new (non-manufacturing) data.
--   3) Removes RLS policies on the dropped tables.
--
-- The app itself also force-cleans these keys at runtime
-- (ensureManufacturingData), so this migration is applied once for
-- a full database-level cleanup.
-- ============================================================

-- 1) Drop manufacturing tables (order respects FKs where present)
drop table if exists public.production_batch_yields;
drop table if exists public.production_batch_materials;
drop table if exists public.production_batch_costs;
drop table if exists public.production_quality_checks;
drop table if exists public.production_storage_history;
drop table if exists public.production_material_requests;
drop table if exists public.production_downtime;
drop table if exists public.production_capacity;
drop table if exists public.production_calendar;
drop table if exists public.production_output;
drop table if exists public.production_jobs;
drop table if exists public.quality_control_records;
drop table if exists public.waste_records;
drop table if exists public.batch_recalls;
drop table if exists public.manufacturing_documents;
drop table if exists public.formula_versions;
drop table if exists public.bom_version_history;
drop table if exists public.product_formulas;
drop table if exists public.raw_materials;
drop table if exists public.unit_conversions;
-- unit_of_measure is kept: it is used as generic configuration for
-- product units across Inventory/Procurement.
-- drop table if exists public.unit_of_measure;

-- 2) Drop any policies that referenced the removed tables
do $$
declare
  t text;
begin
  foreach t in array array[
    'production_jobs','production_batches','production_batch_costs','production_batch_materials',
    'production_batch_yields','production_calendar','production_capacity','production_downtime',
    'production_material_requests','production_storage_history','quality_control_records',
    'waste_records','batch_recalls','manufacturing_documents','product_formulas','formula_versions',
    'bom_version_history','raw_materials','unit_conversions','production_output','unit_of_measure'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'manufacturing access ' || t, t);
  end loop;
end $$;

-- 3) Remove manufacturing data keys from the erp_state JSON bundle
update public.erp_state
set data = jsonb_strip_null(
  data
  - 'rawMaterials' - 'rawMaterialBatches' - 'formulas' - 'formulaVersions' - 'formulaVersionItems'
  - 'bomVersionHistory' - 'productionOrders' - 'productionBatches' - 'productionJobs'
  - 'productionBatchMaterials' - 'productionBatchCosts' - 'productionBatchYields'
  - 'rawMaterialConsumption' - 'productionStorageHistory' - 'qualityControlRecords'
  - 'wasteRecords' - 'productionQualityChecks' - 'productionDowntime' - 'productionCapacity'
  - 'productionCalendar' - 'manufacturingDocuments' - 'batchRecalls'
  - 'productionMaterialRequests' - 'pendingProductionIssues' - 'productionReports'
  - 'production' - 'productionIntelligence'
)
where id is not null;

-- 4) Verify the tables are gone
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('raw_materials','production_jobs','production_batches','product_formulas')
order by table_name;