import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Share {
	id: string;
	collectionId: string;
	slug: string;
	includeNotes: boolean;
	placesSnapshot: Record<string, unknown>[];
	createdAt: string;
	expiresAt: string | null;
}

export function useShare(slug: string) {
	return useQuery({
		queryKey: ["share", slug],
		queryFn: () => api.get<{ share: Share }>(`/shares/${slug}`),
		enabled: !!slug,
	});
}

export function useCreateShare() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: {
			collectionId: string;
			includeNotes?: boolean;
			expiresAt?: string | null;
		}) => api.post<{ share: Share }>("/shares", body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shares"] });
		},
	});
}

export type ShareSummary = Omit<Share, "placesSnapshot"> & {
	collectionTitle: string;
	placeCount: number;
};

export function useShares() {
	return useQuery({
		queryKey: ["shares"],
		queryFn: () => api.get<{ shares: ShareSummary[] }>("/shares"),
	});
}

export function useDeleteShare() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			api.delete<{ success: boolean }>(`/shares/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shares"] });
			queryClient.invalidateQueries({ queryKey: ["share"] });
		},
	});
}
