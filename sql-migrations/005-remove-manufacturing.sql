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

-- 1) Drop the manufacturing analytics materialized view (it depends on the tables below)
drop materialized view if exists public.analytics_production_metrics cascade;

-- 2) Drop manufacturing tables in FK-safe order (children before parents).
--    CASCADE is a safety net so any unlisted dependent object is also removed
--    instead of raising 2BP01 "cannot drop ... because other objects depend on it".
drop table if exists public.material_consumption cascade;
drop table if exists public.production_batch_yields cascade;
drop table if exists public.production_batch_materials cascade;
drop table if exists public.production_batch_costs cascade;
drop table if exists public.production_quality_checks cascade;
drop table if exists public.production_storage_history cascade;
drop table if exists public.production_material_requests cascade;
drop table if exists public.production_downtime cascade;
drop table if exists public.production_capacity cascade;
drop table if exists public.production_calendar cascade;
drop table if exists public.production_output cascade;
drop table if exists public.production_batches cascade;
drop table if exists public.production_jobs cascade;
drop table if exists public.quality_control_records cascade;
drop table if exists public.waste_records cascade;
drop table if exists public.batch_recalls cascade;
drop table if exists public.manufacturing_documents cascade;
drop table if exists public.formula_versions cascade;
drop table if exists public.bom_version_history cascade;
drop table if exists public.product_formulas cascade;
drop table if exists public.raw_materials cascade;
drop table if exists public.unit_conversions cascade;
-- unit_of_measure is kept: it is used as generic configuration for
-- product units across Inventory/Procurement.
-- drop table if exists public.unit_of_measure;

-- 3) Drop any policies that referenced the removed tables
do $$
declare
  t text;
begin
  foreach t in array array[
    'production_jobs','production_batches','production_batch_costs','production_batch_materials',
    'production_batch_yields','production_calendar','production_capacity','production_downtime',
    'production_material_requests','production_storage_history','quality_control_records',
    'waste_records','batch_recalls','manufacturing_documents','product_formulas','formula_versions',
    'bom_version_history','raw_materials','unit_conversions','production_output','unit_of_measure',
    'material_consumption'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'manufacturing access ' || t, t);
  end loop;
end $$;

-- 4) Remove manufacturing data keys from the erp_state JSON bundle
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

-- 5) Verify the tables are gone
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('raw_materials','production_jobs','production_batches',
                     'product_formulas','material_consumption')
order by table_name;