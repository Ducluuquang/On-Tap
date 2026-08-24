// Nội dung Toán lớp 4 — chủ đề Phân số.
// Trong bản thật, phần này do AI sinh ra từ bài con học + qua lớp kiểm tra đúng/sai.
// Ở bản demo, mình soạn sẵn và đã kiểm tra kỹ đáp án.

export const CONCEPTS = [
  { id: 'ps-bang-nhau', name: 'Phân số bằng nhau', difficulty: 'Cơ bản' },
  { id: 'rut-gon', name: 'Rút gọn phân số', difficulty: 'Cơ bản' },
  { id: 'quy-dong', name: 'Quy đồng mẫu số', difficulty: 'Cơ bản' },
  { id: 'so-sanh', name: 'So sánh phân số', difficulty: 'Cơ bản' },
  { id: 'cong-cung-mau', name: 'Cộng phân số cùng mẫu', difficulty: 'Cơ bản' },
]

export const CONCEPT_NAME = Object.fromEntries(CONCEPTS.map((c) => [c.id, c.name]))

// answer = chỉ số (0-based) của đáp án đúng trong options
export const QUESTIONS = [
  // Phân số bằng nhau
  { id: 'q1', concept: 'ps-bang-nhau', q: 'Phân số nào bằng 1/2 ?', options: ['2/4', '3/5', '2/3', '4/9'], answer: 0,
    explain: 'Nhân cả tử và mẫu của 1/2 với 2 được 2/4.', hint: 'Thử nhân tử và mẫu với cùng một số.' },
  { id: 'q2', concept: 'ps-bang-nhau', q: '2/3 = ?/9', options: ['5/9', '6/9', '4/9', '3/9'], answer: 1,
    explain: 'Mẫu nhân 3 (3×3=9) thì tử cũng nhân 3: 2×3 = 6. Vậy 6/9.', hint: 'Mẫu 3 thành 9 là nhân mấy?' },
  { id: 'q3', concept: 'ps-bang-nhau', q: '3/4 = 9/? ', options: ['16', '10', '12', '8'], answer: 2,
    explain: 'Tử nhân 3 (3×3=9) thì mẫu cũng nhân 3: 4×3 = 12.', hint: 'Tử 3 thành 9 là nhân mấy?' },

  // Rút gọn phân số
  { id: 'q4', concept: 'rut-gon', q: 'Rút gọn phân số 6/8 về tối giản?', options: ['3/4', '2/4', '3/8', '6/4'], answer: 0,
    explain: 'Chia cả tử và mẫu cho 2: 6:2=3, 8:2=4. Được 3/4.', hint: 'Số nào chia hết cả 6 và 8?' },
  { id: 'q5', concept: 'rut-gon', q: 'Rút gọn phân số 9/12 về tối giản?', options: ['3/4', '4/3', '3/6', '9/6'], answer: 0,
    explain: 'Chia cả tử và mẫu cho 3: 9:3=3, 12:3=4. Được 3/4.', hint: 'Cả 9 và 12 cùng chia hết cho mấy?' },
  { id: 'q6', concept: 'rut-gon', q: 'Phân số nào đã tối giản (không rút gọn được nữa)?', options: ['4/6', '5/9', '6/8', '10/15'], answer: 1,
    explain: '5 và 9 không có ước chung nào ngoài 1 nên 5/9 đã tối giản. Các phân số kia còn rút gọn được.', hint: 'Tìm phân số mà tử và mẫu không cùng chia hết cho số nào (ngoài 1).' },

  // Quy đồng mẫu số
  { id: 'q7', concept: 'quy-dong', q: 'Quy đồng 1/2 và 1/3, mẫu số chung nhỏ nhất là?', options: ['5', '6', '3', '12'], answer: 1,
    explain: 'Mẫu số chung nhỏ nhất của 2 và 3 là 6.', hint: 'Số nhỏ nhất vừa chia hết cho 2, vừa chia hết cho 3.' },
  { id: 'q8', concept: 'quy-dong', q: 'Quy đồng với mẫu 6: 1/2 = ?/6', options: ['2/6', '3/6', '4/6', '1/6'], answer: 1,
    explain: 'Mẫu 2 thành 6 là nhân 3, nên tử cũng nhân 3: 1×3 = 3. Được 3/6.', hint: 'Mẫu 2 thành 6 là nhân mấy?' },
  { id: 'q9', concept: 'quy-dong', q: 'Quy đồng 1/4 và 1/6 (mẫu chung 12): 1/6 = ?/12', options: ['2/12', '3/12', '6/12', '4/12'], answer: 0,
    explain: 'Mẫu 6 thành 12 là nhân 2, nên tử cũng nhân 2: 1×2 = 2. Được 2/12.', hint: 'Mẫu 6 thành 12 là nhân mấy?' },

  // So sánh phân số
  { id: 'q10', concept: 'so-sanh', q: 'So sánh 2/5 và 3/5', options: ['2/5 < 3/5', '2/5 > 3/5', '2/5 = 3/5', 'Không so sánh được'], answer: 0,
    explain: 'Cùng mẫu số thì tử lớn hơn là phân số lớn hơn. 2 < 3 nên 2/5 < 3/5.', hint: 'Cùng mẫu, chỉ cần so tử số.' },
  { id: 'q11', concept: 'so-sanh', q: 'So sánh 1/2 và 2/3', options: ['1/2 > 2/3', '1/2 < 2/3', '1/2 = 2/3', 'Không so sánh được'], answer: 1,
    explain: 'Quy đồng: 1/2 = 3/6, 2/3 = 4/6. Vì 3/6 < 4/6 nên 1/2 < 2/3.', hint: 'Quy đồng về cùng mẫu 6 rồi so tử.' },
  { id: 'q12', concept: 'so-sanh', q: 'Phân số nào lớn nhất?', options: ['1/2', '2/3', '3/4', '1/4'], answer: 2,
    explain: 'Đổi ra: 1/2=0,5 ; 2/3≈0,67 ; 3/4=0,75 ; 1/4=0,25. Lớn nhất là 3/4.', hint: 'Thử nghĩ mỗi phân số gần bằng bao nhiêu phần của 1.' },

  // Cộng phân số cùng mẫu
  { id: 'q13', concept: 'cong-cung-mau', q: '1/5 + 2/5 = ?', options: ['3/10', '3/5', '2/5', '3/25'], answer: 1,
    explain: 'Cùng mẫu: cộng tử, giữ nguyên mẫu. 1+2 = 3, được 3/5.', hint: 'Giữ nguyên mẫu, cộng hai tử số.' },
  { id: 'q14', concept: 'cong-cung-mau', q: '2/7 + 3/7 = ?', options: ['5/7', '5/14', '6/7', '5/49'], answer: 0,
    explain: 'Cùng mẫu: 2+3 = 5, giữ mẫu 7. Được 5/7.', hint: 'Cộng tử, mẫu giữ nguyên.' },
  { id: 'q15', concept: 'cong-cung-mau', q: '3/8 + 4/8 = ?', options: ['7/16', '7/8', '12/8', '7/64'], answer: 1,
    explain: 'Cùng mẫu: 3+4 = 7, giữ mẫu 8. Được 7/8.', hint: 'Cộng tử, mẫu giữ nguyên.' },
]

export function questionsFor(conceptId) {
  return QUESTIONS.filter((q) => q.concept === conceptId)
}
