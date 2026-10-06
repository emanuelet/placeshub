export function formatDate(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown date";
	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);
}
