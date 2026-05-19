-- Admin dashboard stats RPC
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_workspaces', (SELECT COUNT(*) FROM public.organizations),
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_contracts', (SELECT COUNT(*) FROM public.contracts),
    'anchored_contracts', (SELECT COUNT(*) FROM public.contracts WHERE stellar_tx_hash IS NOT NULL),
    'total_revenue', (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'paid'),
    'contracts_this_week', (SELECT COUNT(*) FROM public.contracts WHERE created_at >= NOW() - INTERVAL '7 days'),
    'users_this_week', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= NOW() - INTERVAL '7 days'),
    'recent_organizations', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'type', o.type, 'created_at', o.created_at,
        'member_count', (SELECT COUNT(*) FROM public.organization_members m WHERE m.organization_id = o.id)) ORDER BY o.created_at DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.organizations ORDER BY created_at DESC LIMIT 5) o
    )
  ) INTO result;
  RETURN result;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;
