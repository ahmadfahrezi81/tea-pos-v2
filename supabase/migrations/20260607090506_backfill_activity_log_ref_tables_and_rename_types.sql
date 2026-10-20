-- ─── Backfill ref_table values renamed on 2026-05-28 ─────────────────────────

UPDATE tenant_activity_logs SET ref_table = 'store_daily_summaries'       WHERE ref_table = 'daily_summaries';
UPDATE tenant_activity_logs SET ref_table = 'store_daily_summary_photos'   WHERE ref_table = 'daily_summary_photos';
UPDATE tenant_activity_logs SET ref_table = 'store_expenses'               WHERE ref_table = 'expenses';
UPDATE tenant_activity_logs SET ref_table = 'store_requests'               WHERE ref_table = 'supply_requests';
UPDATE tenant_activity_logs SET ref_table = 'store_reports'                WHERE ref_table = 'incident_reports';
UPDATE tenant_activity_logs SET ref_table = 'store_orders'                 WHERE ref_table = 'orders';
UPDATE tenant_activity_logs SET ref_table = 'store_order_payments'         WHERE ref_table = 'payments';
UPDATE tenant_activity_logs SET ref_table = 'tenant_products'              WHERE ref_table = 'products';
UPDATE tenant_activity_logs SET ref_table = 'tenant_product_categories'    WHERE ref_table = 'product_categories';
UPDATE tenant_activity_logs SET ref_table = 'tenant_customer_feedbacks'    WHERE ref_table = 'customer_feedbacks';
UPDATE tenant_activity_logs SET ref_table = 'tenant_commission_configs'    WHERE ref_table = 'commission_configs';
UPDATE tenant_activity_logs SET ref_table = 'payroll_reimbursements'       WHERE ref_table = 'reimbursements';
UPDATE tenant_activity_logs SET ref_table = 'users'                        WHERE ref_table = 'profiles';

-- ─── Rename event types to consistent naming convention ───────────────────────

UPDATE tenant_activity_logs SET type = 'store_opened'            WHERE type = 'store_open';
UPDATE tenant_activity_logs SET type = 'store_closed'            WHERE type = 'daily_summary_closed';
UPDATE tenant_activity_logs SET type = 'opening_balance_updated' WHERE type = 'balance_updated';
UPDATE tenant_activity_logs SET type = 'summary_photo_uploaded'  WHERE type = 'photo_uploaded';
UPDATE tenant_activity_logs SET type = 'summary_photo_deleted'   WHERE type = 'photo_deleted';
UPDATE tenant_activity_logs SET type = 'summary_photo_updated'   WHERE type = 'photo_quantity_updated';
