# INSTOOL SALES PORTAL — CLOUDFLARE PAGES & D1
**Cổng làm việc trực tuyến 24/7 dành cho đội ngũ Sale (100% Miễn phí)**

---

## 1. TỔNG QUAN HỆ THỐNG
Trang web này được xây dựng riêng để chạy trực tiếp trên **Cloudflare Pages** kết hợp **Cloudflare D1 SQL Database**:
* **Chi phí vận hành:** 0 đồng (Free Tier vĩnh viễn: 5 triệu lượt đọc/ngày).
* **Tốc độ:** Siêu mượt, độ trễ cực thấp tại Việt Nam nhờ hệ thống Edge của Cloudflare.
* **Tính năng chuyên sâu cho Sale:**
  * Xem điểm đánh giá nhu cầu từ AI (5 tiêu chí thành phần).
  * Đọc bằng chứng thực tế & điểm đau (Pain points) trong video của khách để mở đầu câu chuyện.
  * Quy trình **1-Click Outreach:** Bấm 1 nút ➔ Tự động chép DM ➔ Mở thẳng Instagram Chat (`ig.me/m/...`) ➔ Tự chuyển trạng thái sang `Đã gửi DM` ➔ Tự lên lịch nhắc Follow-up sau 3 ngày.
  * Quản lý tiến độ bán hàng (Sale Pipeline): Đang trao đổi, Đã gửi Demo, Chốt đơn, Từ chối.
  * Hộp ghi chú chăm sóc khách hàng lưu trực tiếp về Cloudflare D1.

---

## 2. HƯỚNG DẪN TRIỂN KHAI LÊN CLOUDFLARE (3 BƯỚC NHANH)

### Bước 1: Tạo Database D1 trên Cloudflare Dashboard
1. Truy cập [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Vào mục **Storage & Databases** ➔ Chọn **D1 SQL Database**.
3. Bấm **Create database** ➔ Đặt tên là `instool_leads_db` ➔ Bấm Create.
4. Chọn tab **Console** trong database vừa tạo, mở tệp `schema.sql` trong thư mục này, copy toàn bộ nội dung dán vào và bấm **Execute**.
5. Copy mã **Database ID** (dạng `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

### Bước 2: Tạo dự án Cloudflare Pages
1. Vào mục **Compute (Workers & Pages)** ➔ Chọn **Pages** ➔ **Create a project**.
2. **Cách A (Khuyên dùng - Qua GitHub):**
   * Đẩy thư mục `D:\Code\Instool_Website` lên 1 repo GitHub riêng.
   * Kết nối repo với Cloudflare Pages.
   * Cài đặt Build:
     * Framework preset: `None`
     * Build output directory: `public`
3. **Cách B (Trực tiếp qua dòng lệnh Wrangler):**
   ```bash
   npx wrangler pages deploy public --project-name instool-sales-portal
   ```

### Bước 3: Ràng buộc D1 vào Pages (D1 Binding)
1. Trong trang cài đặt dự án Pages vừa tạo: Vào **Settings** ➔ **Functions** ➔ Tìm mục **D1 Database Bindings**.
2. Bấm **Add binding**:
   * **Variable name:** Nhập chính xác chữ `DB` (viết hoa).
   * **D1 database:** Chọn `instool_leads_db` đã tạo ở Bước 1.
3. Bấm **Save**. Trang web Sale của bạn đã hoàn tất và kết nối thông suốt với D1!

---

## 3. KẾT NỐI VỚI PHẦN MỀM INSTOOL (DESKTOP)
1. Vào mục **My Profile** trên Cloudflare ➔ **API Tokens** ➔ **Create Token** ➔ Chọn template **D1 Edit**.
2. Mở phần mềm Instool tại máy của bạn ➔ Vào mục **Cài đặt**:
   * **Cloudflare Account ID:** Copy từ trang chủ Dashboard.
   * **Cloudflare D1 Database ID:** Mã ID ở Bước 1.
   * **Cloudflare API Token:** Mã Token vừa tạo.
   * **Địa chỉ Website Sale:** Đường dẫn trang Pages của bạn (ví dụ: `https://instool-sales-portal.pages.dev`).
3. Bấm **Kiểm tra kết nối D1** ➔ Bấm **Lưu cài đặt**.
4. Giờ đây bạn chỉ cần vào **Quản lý khách hàng**, chọn các lead chất lượng và bấm **"Đẩy lên Dữ liệu trực tuyến"** là team Sale có thể bắt đầu làm việc ngay!
