export function formatToMMDDYYYY(dateString: string) {
    const date = new Date(dateString.replace(' ', 'T')); // Standardize to ISO 8601
    if (isNaN(date.getTime())) return null; // Invalid date check
    
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    
    return `${mm}/${dd}/${yyyy}`;
}