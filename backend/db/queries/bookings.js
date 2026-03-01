export const getBookingsForResource = `SELECT id, booker, resource_id AS resourceId, DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate, DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate, comment, confirmed, seen, defect_reported, defect_image FROM bookings WHERE resource_id = ? ORDER BY start_date`;
export const getAllBookings = `SELECT id, booker, resource_id AS resourceId, DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate, DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate, comment, confirmed, seen, defect_reported, defect_image FROM bookings ORDER BY start_date`;
export const getBookingsByBooker = `SELECT id, booker, resource_id AS resourceId, DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate, DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate, comment, confirmed, seen, defect_reported, defect_image FROM bookings WHERE booker = ? ORDER BY start_date`;

export const checkAvailabilityExists = `SELECT 1 FROM availabilities WHERE resource_id = ? AND start_date <= ? AND end_date >= ?`;
export const checkConfirmedBookingConflict = `SELECT 1 FROM bookings WHERE resource_id = ? AND confirmed = 1 AND NOT (end_date < ? OR start_date > ?)`;
export const checkAnyNonDeclinedBookingConflict = `SELECT 1 FROM bookings WHERE resource_id = ? AND (confirmed IS NULL OR confirmed = 0 OR confirmed = 1) AND NOT (end_date < ? OR start_date > ?)`;

export const insertBooking = `INSERT INTO bookings (booker, resource_id, start_date, end_date, comment) VALUES (?, ?, ?, ?, ?)`;
export const selectImageForResource = `SELECT image FROM resources WHERE id = ?`;
export const selectBookingById = `SELECT id, booker, resource_id AS resourceId, DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate, DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate FROM bookings WHERE id = ?`;

export const confirmBookingById = `UPDATE bookings SET confirmed = 1 WHERE id = ?`;
export const declineBookingById = `UPDATE bookings SET confirmed = 2 WHERE id = ?`;

export const getBookingsForUserOrOwner = `SELECT b.id, b.booker, b.resource_id AS resourceId, DATE_FORMAT(b.start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(b.end_date, '%Y-%m-%d') AS end_date, b.comment
									FROM bookings b
									LEFT JOIN resources r ON b.resource_id = r.id
									WHERE ? IN (b.booker, r.owner)
									ORDER BY start_date`;

export const checkActiveBookingsForOwner = `SELECT 1 FROM bookings b JOIN resources r ON b.resource_id = r.id WHERE r.owner = ? AND (b.end_date IS NULL OR DATE(b.end_date) >= CURRENT_DATE) LIMIT 1`;

export const reportDefectOnBooking = `UPDATE bookings SET defect_reported = ?, defect_image = ? WHERE id = ?`;
export const getActiveBookingsForResource = `SELECT 1 FROM bookings WHERE resource_id = ? AND (DATE(end_date) >= CURRENT_DATE OR end_date IS NULL)`;
export const getActiveBookingDetailsForResource = `SELECT id, booker FROM bookings WHERE resource_id = ? AND (DATE(end_date) >= CURRENT_DATE OR end_date IS NULL)`;

export const getUnseenBookingsCountForBooker = `SELECT COUNT(*) as unseen_count FROM bookings WHERE booker = ? AND seen = FALSE AND (confirmed = 1 OR confirmed = 2)`;

export const markBookingAsSeen = `UPDATE bookings SET seen = TRUE WHERE id = ? AND LOWER(TRIM(booker)) = LOWER(TRIM(?))`;
