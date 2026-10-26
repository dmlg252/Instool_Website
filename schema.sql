-- =========================================================================
-- INSTOOL SALES PORTAL - CLOUDFLARE D1 DATABASE SCHEMA
-- Bảng lưu trữ khách hàng tiềm năng cho đội ngũ Sale làm việc trực tuyến
-- =========================================================================

CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    bio TEXT,
    followers INTEGER DEFAULT 0,
    reels_last_30d INTEGER DEFAULT 0,
    category_name TEXT,
    
    -- Đánh giá AI
    fit_score INTEGER DEFAULT 0,
    confidence TEXT DEFAULT 'Medium',
    ai_result TEXT,
    detected_industry TEXT,
    business_type TEXT,
    score_breakdown TEXT DEFAULT '{}',
    ai_evidence TEXT DEFAULT '[]',
    suggested_dm TEXT,
    
    -- Quản lý tiến độ bán hàng (Sale Pipeline)
    sale_status TEXT DEFAULT 'New',         -- New | Contacted | In_Discussion | Demo_Sent | Won | Lost
    sale_tag TEXT,                         -- Hot | Interested | Price_Check | Follow_up
    sale_note TEXT,
    sale_assigned_to TEXT,
    follow_up_at TEXT,
    contacted_at TEXT,
    
    -- Dấu thời gian
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Chỉ mục tối ưu tốc độ truy vấn trên Cloudflare Edge
CREATE INDEX IF NOT EXISTS idx_leads_username ON leads(username);
CREATE INDEX IF NOT EXISTS idx_leads_sale_status ON leads(sale_status);
CREATE INDEX IF NOT EXISTS idx_leads_fit_score ON leads(fit_score);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON leads(follow_up_at);
CREATE INDEX IF NOT EXISTS idx_leads_updated_at ON leads(updated_at);

-- Dữ liệu mẫu ban đầu để kiểm thử hiển thị giao diện ngay khi deploy
INSERT OR IGNORE INTO leads (
    username, full_name, bio, followers, reels_last_30d, category_name,
    fit_score, confidence, ai_result, detected_industry, business_type,
    score_breakdown, ai_evidence, suggested_dm, sale_status, sale_tag, sale_note
) VALUES (
    'coach.alexander',
    'Alexander | High-Performance Fitness Coach',
    'Helping busy CEOs drop 10kg in 90 days. Daily fitness & nutrition protocols. DM "FIT" to transform.',
    18500,
    14,
    'Fitness Coach / Health',
    88,
    'High',
    'Qualified',
    'Fitness & Health Coaching',
    'High-Ticket Coaching',
    '{"video_volume": 25, "engagement_gap": 26, "monetization": 24, "capacity_bottleneck": 13}',
    '["Đăng video đều đặn 3-4 Reels/tuần nhưng phần Hook 3 giây đầu bị trễ, thiếu phụ đề nhấn mạnh từ khóa.", "Bán gói coaching giá cao, có phễu bio rõ ràng nên ngân sách dồi dào.", "Đoạn cắt thoại có nhiều khoảng lặng chết (dead pauses), có thể tối ưu tăng 40% retention."]',
    'Chào anh Alexander, em vừa xem qua chuỗi Reels chia sẻ về chế độ dinh dưỡng cho CEO trên kênh của anh, nội dung thực sự rất giá trị. Tuy nhiên em nhận thấy nhịp cắt thoại ở 3 giây đầu đang hơi chậm và chưa có visual hook kéo người xem. Bên em chuyên tối ưu retention và nhịp dựng kiểu Alex Hormozi. Em muốn xin phép dựng thử miễn phí 1 video Reel ngắn từ source cũ để anh xem chất lượng. Nếu ưng ý anh em mình trao đổi tiếp nhé?',
    'New',
    'Hot',
    'Lead rất tiềm năng, kênh phát triển tốt, cần gửi video demo hook'
);
