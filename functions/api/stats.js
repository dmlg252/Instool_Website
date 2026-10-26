// =========================================================================
// Cloudflare Pages Function: /api/stats
// Trả về số liệu thống kê phễu bán hàng thời gian thực
// =========================================================================

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return Response.json({ success: false, error: "Database D1 chưa được liên kết." }, { status: 500 });
    }

    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN sale_status = 'New' OR (follow_up_at IS NOT NULL AND date(follow_up_at) <= date('now', '+1 day')) THEN 1 ELSE 0 END) as today_due,
        SUM(CASE WHEN sale_status = 'New' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN sale_status IN ('Contacted', 'In_Discussion', 'Demo_Sent') THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN sale_status = 'Won' THEN 1 ELSE 0 END) as won_count,
        SUM(CASE WHEN sale_status = 'Lost' THEN 1 ELSE 0 END) as lost_count
      FROM leads;
    `;

    const stmt = db.prepare(query);
    const result = await stmt.first();

    return Response.json({
      success: true,
      stats: {
        total: result?.total || 0,
        today_due: result?.today_due || 0,
        new: result?.new_count || 0,
        active: result?.active_count || 0,
        won: result?.won_count || 0,
        lost: result?.lost_count || 0
      }
    });

  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
