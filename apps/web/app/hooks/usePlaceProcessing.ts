import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type ProcessingJob = {
	id: string;
	status: string;
	candidates:
		| {
				googlePlaceId: string;
				name: string;
				address: string | null;
				lat: number | null;
				lng: number | null;
		  }[]
		| null;
	attempts: number;
	lastError: string | null;
	nextAttemptAt: string;
	updatedAt: string;
	place: {
		id: string;
		name: string;
		googlePlaceId: string;
		lat: number | null;
		lng: number | null;
		address: string | null;
	};
};

export type ProcessingData = {
	jobs: ProcessingJob[];
	counts: Record<string, number>;
	usage: {
		attempts: number;
		dailyLimit: number;
		target: number;
		nextRequestAt: string | null;
	};
};

export function usePlaceProcessing(status?: string) {
	return useQuery({
		queryKey: ["placeProcessing", status],
		queryFn: () =>
			api.get<ProcessingData>(
				`/place-processing${status ? `?status=${encodeURIComponent(status)}` : ""}`,
			),
	});
}

export function usePlaceProcessingAction() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			action,
			googlePlaceId,
		}: {
			id: string;
			action: "retry" | "skip" | "select-candidate";
			googlePlaceId?: string;
		}) =>
			api.post(
				`/place-processing/${id}/${action}`,
				googlePlaceId ? { googlePlaceId } : {},
			),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["placeProcessing"] }),
	});
}

export function useTimezone() {
	return useQuery({
		queryKey: ["timezone"],
		queryFn: () => api.get<{ timezone: string }>("/settings/timezone"),
	});
}

export function useUpdateTimezone() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (timezone: string) =>
			api.patch<{ timezone: string }>("/settings/timezone", { timezone }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["timezone"] }),
	});
}
