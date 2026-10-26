// =========================================================================
// Cloudflare Pages Function: /api/leads
// Xử lý lấy danh sách khách hàng và cập nhật tiến độ bán hàng vào D1
// Hỗ trợ mở rộng quản lý 5.000+ khách hàng theo đợt và phân bổ Sale
// =========================================================================

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return Response.json({
        success: false,
        error: "Cơ sở dữ liệu D1 chưa được liên kết (Binding 'DB' is missing)."
      }, { status: 500 });
    }

    const url = new URL(context.request.url);
    const tab = url.searchParams.get("tab") || "today";
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const batch = url.searchParams.get("batch") || "all";
    const assignedTo = url.searchParams.get("assigned_to") || "all";
    const minScore = url.searchParams.get("min_score");
    const maxScore = url.searchParams.get("max_score");
    const minFollowers = url.searchParams.get("min_followers");
    const maxFollowers = url.searchParams.get("max_followers");
    const minReels = url.searchParams.get("min_reels");
    const industry = (url.searchParams.get("industry") || "").trim().toLowerCase();
    const sortBy = url.searchParams.get("sort_by") || "default";

    let query = "SELECT * FROM leads WHERE 1=1";
    const params = [];

    // 1. Phân loại theo Tab nghiệp vụ
    if (tab === "today") {
      // Khách mới chưa gửi tin HOẶC khách đến hạn nhắc hôm nay/trễ hạn
      query += " AND (sale_status = 'New' OR (follow_up_at IS NOT NULL AND date(follow_up_at) <= date('now', '+1 day')))";
    } else if (tab === "new") {
      query += " AND sale_status = 'New'";
    } else if (tab === "active") {
      query += " AND sale_status IN ('Contacted', 'In_Discussion', 'Demo_Sent')";
    } else if (tab === "won") {
      query += " AND sale_status = 'Won'";
    } else if (tab === "lost") {
      query += " AND sale_status = 'Lost'";
    }

    // 2. Lọc theo Đợt tải lên (Batch / Created Date) - Giải quyết bài toán 5.000 khách
    if (batch === "today") {
      query += " AND date(created_at) = date('now')";
    } else if (batch === "last_3d") {
      query += " AND date(created_at) >= date('now', '-3 days')";
    } else if (batch === "last_7d") {
      query += " AND date(created_at) >= date('now', '-7 days')";
    } else if (batch === "last_30d") {
      query += " AND date(created_at) >= date('now', '-30 days')";
    } else if (batch === "older") {
      query += " AND date(created_at) < date('now', '-30 days')";
    }

    // 3. Lọc theo Người phụ trách / Phân bổ
    if (assignedTo === "unassigned") {
      query += " AND (sale_assigned_to IS NULL OR sale_assigned_to = '')";
    } else if (assignedTo === "assigned") {
      query += " AND (sale_assigned_to IS NOT NULL AND sale_assigned_to != '')";
    } else if (assignedTo && assignedTo !== "all") {
      query += " AND LOWER(sale_assigned_to) LIKE ?";
      params.push(`%${assignedTo.toLowerCase()}%`);
    }

    // 4. Tìm kiếm từ khóa đa năng
    if (search) {
      query += " AND (LOWER(username) LIKE ? OR LOWER(full_name) LIKE ? OR LOWER(sale_note) LIKE ? OR LOWER(detected_industry) LIKE ? OR LOWER(bio) LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    // 5. Mức điểm AI
    if (minScore !== null && minScore !== "" && !isNaN(minScore)) {
      query += " AND fit_score >= ?";
      params.push(parseInt(minScore));
    }
    if (maxScore !== null && maxScore !== "" && !isNaN(maxScore)) {
      query += " AND fit_score <= ?";
      params.push(parseInt(maxScore));
    }

    // 6. Quy mô Followers
    if (minFollowers !== null && minFollowers !== "" && !isNaN(minFollowers)) {
      query += " AND followers >= ?";
      params.push(parseInt(minFollowers));
    }
    if (maxFollowers !== null && maxFollowers !== "" && !isNaN(maxFollowers)) {
      query += " AND followers <= ?";
      params.push(parseInt(maxFollowers));
    }

    // 7. Số Reels trong 30 ngày
    if (minReels !== null && minReels !== "" && !isNaN(minReels)) {
      query += " AND reels_last_30d >= ?";
      params.push(parseInt(minReels));
    }

    // 8. Ngành nghề
    if (industry && industry !== "all") {
      query += " AND LOWER(detected_industry) LIKE ?";
      params.push(`%${industry}%`);
    }

    // 9. Sắp xếp thông minh
    if (sortBy === "followers_desc") {
      query += " ORDER BY followers DESC, updated_at DESC";
    } else if (sortBy === "reels_desc") {
      query += " ORDER BY reels_last_30d DESC, updated_at DESC";
    } else if (sortBy === "created_desc") {
      query += " ORDER BY created_at DESC";
    } else if (sortBy === "updated_desc") {
      query += " ORDER BY updated_at DESC";
    } else if (sortBy === "score_desc") {
      query += " ORDER BY fit_score DESC, updated_at DESC";
    } else {
      // Mặc định: Ưu tiên khách cần làm hôm nay, sau đó đến điểm cao và mới tải lên
      query += " ORDER BY CASE WHEN follow_up_at IS NOT NULL AND date(follow_up_at) <= date('now', '+1 day') THEN 0 ELSE 1 END, fit_score DESC, created_at DESC";
    }

    query += " LIMIT 1000";

    const stmt = db.prepare(query);
    const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

    // Parse JSON fields safely
    const leads = (result.results || []).map(lead => {
      let breakdown = {};
      let evidence = [];
      try {
        breakdown = JSON.parse(lead.score_breakdown || "{}");
      } catch (e) {
        breakdown = {};
      }
      try {
        evidence = JSON.parse(lead.ai_evidence || "[]");
      } catch (e) {
        evidence = [];
      }
      return {
        ...lead,
        score_breakdown_parsed: breakdown,
        ai_evidence_parsed: evidence
      };
    });

    return Response.json({
      success: true,
      leads: leads,
      count: leads.length
    }, {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return Response.json({
      success: false,
      error: "Lỗi truy vấn D1: " + err.message
    }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return Response.json({ success: false, error: "Database D1 chưa được liên kết." }, { status: 500 });
    }

    let body = {};
    const contentType = context.request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await context.request.json();
    } else {
      const formData = await context.request.formData();
      for (const [key, value] of formData.entries()) {
        body[key] = value;
      }
    }

    const { id, username, sale_status, sale_tag, sale_note, sale_assigned_to, follow_up_at, contacted_at } = body;

    if (!id && !username) {
      return Response.json({ success: false, error: "Thiếu thông tin nhận diện ID hoặc Username của khách." }, { status: 400 });
    }

    let updateFields = [];
    let params = [];

    if (sale_status !== undefined) {
      updateFields.push("sale_status = ?");
      params.push(sale_status);
    }
    if (sale_tag !== undefined) {
      updateFields.push("sale_tag = ?");
      params.push(sale_tag);
    }
    if (sale_note !== undefined) {
      updateFields.push("sale_note = ?");
      params.push(sale_note);
    }
    if (sale_assigned_to !== undefined) {
      updateFields.push("sale_assigned_to = ?");
      params.push(sale_assigned_to);
    }
    if (follow_up_at !== undefined) {
      updateFields.push("follow_up_at = ?");
      params.push(follow_up_at);
    }
    if (contacted_at !== undefined) {
      updateFields.push("contacted_at = ?");
      params.push(contacted_at);
    }

    updateFields.push("updated_at = datetime('now')");

    let whereClause = "";
    if (id) {
      whereClause = "WHERE id = ?";
      params.push(id);
    } else {
      whereClause = "WHERE username = ?";
      params.push(username);
    }

    const sql = `UPDATE leads SET ${updateFields.join(", ")} ${whereClause};`;
    const stmt = db.prepare(sql).bind(...params);
    await stmt.run();

    return Response.json({
      success: true,
      message: "Đã cập nhật tiến độ chăm sóc khách hàng thành công!"
    });

  } catch (err) {
    return Response.json({
      success: false,
      error: "Lỗi cập nhật D1: " + err.message
    }, { status: 500 });
  }
}
