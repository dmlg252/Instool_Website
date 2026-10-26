// =========================================================================
// Cloudflare Pages Function: /api/leads
// Xử lý lấy danh sách khách hàng và cập nhật tiến độ bán hàng vào D1
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
    const minScore = url.searchParams.get("min_score");
    const maxScore = url.searchParams.get("max_score");
    const minFollowers = url.searchParams.get("min_followers");
    const maxFollowers = url.searchParams.get("max_followers");
    const minReels = url.searchParams.get("min_reels");
    const industry = (url.searchParams.get("industry") || "").trim().toLowerCase();
    const sortBy = url.searchParams.get("sort_by") || "default";

    let query = "SELECT * FROM leads WHERE 1=1";
    const params = [];

    // Filter by Tab
    if (tab === "today") {
      // Khách mới chưa nhắn HOẶC khách đến hạn nhắc hôm nay/trễ hạn
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

    // Keyword Search (username, full_name, bio, sale_note, detected_industry)
    if (search) {
      query += " AND (LOWER(username) LIKE ? OR LOWER(full_name) LIKE ? OR LOWER(sale_note) LIKE ? OR LOWER(detected_industry) LIKE ? OR LOWER(bio) LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    // Fit Score
    if (minScore !== null && minScore !== "" && !isNaN(minScore)) {
      query += " AND fit_score >= ?";
      params.push(parseInt(minScore));
    }
    if (maxScore !== null && maxScore !== "" && !isNaN(maxScore)) {
      query += " AND fit_score <= ?";
      params.push(parseInt(maxScore));
    }

    // Followers
    if (minFollowers !== null && minFollowers !== "" && !isNaN(minFollowers)) {
      query += " AND followers >= ?";
      params.push(parseInt(minFollowers));
    }
    if (maxFollowers !== null && maxFollowers !== "" && !isNaN(maxFollowers)) {
      query += " AND followers <= ?";
      params.push(parseInt(maxFollowers));
    }

    // Reels 30d
    if (minReels !== null && minReels !== "" && !isNaN(minReels)) {
      query += " AND reels_last_30d >= ?";
      params.push(parseInt(minReels));
    }

    // Industry
    if (industry && industry !== "all") {
      query += " AND LOWER(detected_industry) LIKE ?";
      params.push(`%${industry}%`);
    }

    // Sorting
    if (sortBy === "followers_desc") {
      query += " ORDER BY followers DESC, updated_at DESC";
    } else if (sortBy === "reels_desc") {
      query += " ORDER BY reels_last_30d DESC, updated_at DESC";
    } else if (sortBy === "updated_desc") {
      query += " ORDER BY updated_at DESC";
    } else if (sortBy === "score_desc") {
      query += " ORDER BY fit_score DESC, updated_at DESC";
    } else {
      // Default: prioritize today due follow-ups, then high fit score, then latest update
      query += " ORDER BY CASE WHEN follow_up_at IS NOT NULL AND date(follow_up_at) <= date('now', '+1 day') THEN 0 ELSE 1 END, fit_score DESC, updated_at DESC";
    }

    query += " LIMIT 500";

    const stmt = db.prepare(query);
    const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

    // Parse JSON fields safely for each lead
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
