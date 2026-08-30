---
title: File Management Standard
category: attachment
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 1.0.0
---

# File Management Standard

> Nguồn chân lý duy nhất cho quy tắc đặt tên, phân loại, vòng đời và ownership của mọi file tài liệu trong dự án.

## 1. Phạm vi áp dụng

- Áp dụng cho mọi file tài liệu (`.md`, `.json`, `.yaml`, `.sql`, `.png`, `.svg`, `.pdf`) nằm trong `docs/`.
- **Không** áp dụng cho source code (đã có convention riêng của từng ngôn ngữ trong thư mục tương ứng).
- Mọi tài liệu mới tạo phải tuân theo file này. Vi phạm phải được sửa trước khi merge.

## 2. Cấu trúc thư mục chuẩn

```
docs/
├── README.md                       # Mục lục, dẫn vào từng nhóm
├── FILE_MANAGEMENT.md              # File này
│
├── 01_plan/                        # Kế hoạch tổng, kiến trúc
├── 02_design/                      # Thiết kế (UI/UX, schema, ERD)
├── 03_api/                         # Tài liệu API
├── 04_runbook/                     # Vận hành
├── 05_test/                        # Báo cáo test
├── 06_changelog/                   # Lịch sử thay đổi
└── 99_attachments/                 # Tài liệu tham khảo, mock, spec ngoài
```

**Nguyên tắc:**
- Mỗi tài liệu thuộc đúng **1 danh mục** (1 thư mục). Nếu đa chủ đề → tách thành nhiều file.
- Không tạo thư mục ngoài 7 danh mục trên. Nếu thực sự cần, phải cập nhật file này trước (tăng version).

## 3. Quy tắc đặt tên file

- **Chữ thường, snake_case**: `test_report_phase1.md` (không `TestReport-Phase1.md`).
- Số thứ tự ở đầu tên thư mục (`01_plan/`, `02_design/`) để sắp xếp tự nhiên.
- **Không dấu, không space, không ký tự đặc biệt** ngoài `-` `_` `.`.
- **Giới hạn**: tên file ≤ 64 ký tự (tính cả extension).
- File đặc biệt dùng `CHANGELOG_*.md` (chữ hoa) để dễ nhận biết, theo quy ước keep-a-changelog.

## 4. Bảng phân loại danh mục

| Prefix thư mục | Danh mục | Khi nào dùng | Ví dụ file |
|---|---|---|---|
| `01_plan/` | Kế hoạch | Roadmap, kiến trúc, phase, kế hoạch tổng | `plan_overview.md` |
| `02_design/` | Thiết kế | UI/UX, design system, schema, ERD, wireframe | `design_system.md` |
| `03_api/` | API | Reference, ví dụ, WS protocol | `api_reference.md` |
| `04_runbook/` | Vận hành | Triển khai, troubleshooting, hướng dẫn vận hành | `runbook_deploy.md` |
| `05_test/` | Test | Plan + report theo phase | `test_report_phase1.md` |
| `06_changelog/` | Lịch sử | Mọi thay đổi theo thời gian | `CHANGELOG_webapp.md` |
| `99_attachments/` | Tham khảo | Mock, sample, spec từ bên ngoài | `payload_spec_v1.md` |

## 5. Frontmatter bắt buộc cho mọi file `.md`

Mọi file `.md` trong `docs/` (trừ `README.md` của thư mục root và các thư mục con có thể dùng form tối giản) phải có frontmatter YAML ở đầu file:

```yaml
---
title: <Tên tài liệu>
category: <plan|design|api|runbook|test|changelog|attachment>
owner: <người phụ trách>
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: <draft|in-review|approved|archived>
version: <semver, vd 0.1.0>
---
```

- Cập nhật `updated` mỗi lần sửa nội dung đáng kể.
- Tăng `version` theo semver (MAJOR: thay đổi cấu trúc lớn; MINOR: thêm section; PATCH: sửa typo/chính tả).
- `status`:
  - `draft` — đang viết, chưa review.
  - `in-review` — đã gửi review.
  - `approved` — đã được duyệt, là nguồn chân lý.
  - `archived` — lỗi thời, sẽ chuyển vào thư mục archive.

## 6. Quy trình tạo / sửa / archive

### 6.1 Tạo mới
1. Xác định danh mục theo bảng mục 4.
2. Đặt tên file theo mục 3.
3. Thêm frontmatter theo mục 5.
4. Thêm file vào mục lục `docs/README.md` (nếu là file quan trọng).

### 6.2 Sửa
- Giữ nguyên tên file (KHÔNG đổi tên trừ khi đổi danh mục).
- Cập nhật `updated` + tăng `version` theo semver.
- Mô tả thay đổi ở cuối file trong section **Change history** (format: `## Change history` + danh sách `- YYYY-MM-DD: mô tả`).

### 6.3 Archive
- KHÔNG xoá file. Chuyển vào thư mục con `archived_<category>_<YYYY-MM>/` trong cùng danh mục hoặc `99_attachments/`.
- Đổi `status: archived`, giữ nguyên nội dung.

## 7. Liên kết chéo

- Dùng **relative path**: `[X](./02_design/design_system.md)`.
- Tuyệt đối không link tới file ngoài `docs/` mà không dùng relative path tương đối.
- Khi di chuyển file, **grep toàn repo** và cập nhật mọi link tham chiếu trong cùng PR.

## 8. Quy tắc ngôn ngữ

- **Tài liệu kỹ thuật nội bộ** (plan, design, api, test, changelog): **tiếng Anh**.
- **Tài liệu hướng dẫn vận hành nội bộ** (runbook): **tiếng Việt** được phép (phù hợp đội ngũ vận hành nhà máy).
- **Commit message và PR mô tả**: tiếng Anh.
- UI/UX label trong webapp: tiếng Anh (xem `plan_uiux_concept.md`).

## 9. Audit & review định kỳ

- Mỗi quý: review `docs/FILE_MANAGEMENT.md` và `docs/README.md`, archive file lỗi thời.
- File lỗi thời > 6 tháng không cập nhật → đánh `status: archived` và chuyển thư mục theo mục 6.3.
- Mỗi lần sửa `FILE_MANAGEMENT.md` → tăng version MAJOR (vì thay đổi quy ước ảnh hưởng mọi PR sau).

## 10. Checklist trước khi commit tài liệu

- [ ] File nằm đúng thư mục theo danh mục ở mục 4.
- [ ] Tên file đúng snake_case (mục 3).
- [ ] Có frontmatter đầy đủ (mục 5).
- [ ] Có mục "Change history" ở cuối file (mục 6.2).
- [ ] Không chứa secret (password, token, MAC thật, IP nội bộ).
- [ ] Link nội bộ dùng relative path (mục 7).
- [ ] Ngôn ngữ đúng quy tắc (mục 8).

## Change history

- 2026-08-30: Tạo file chuẩn quản lý tài liệu cho dự án (M0).
