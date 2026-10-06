import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import { type Session, supabase, type User } from "./supabase";

interface AuthContextValue {
	user: User | null;
	session: Session | null;
	loading: boolean;
	googleAuthEnabled: boolean;
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (
		email: string,
		password: string,
		displayName?: string,
	) => Promise<boolean>;
	signOut: () => Promise<void>;
	signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);
	const [googleAuthEnabled, setGoogleAuthEnabled] = useState(false);

	useEffect(() => {
		supabase.auth
			.getSession()
			.then(({ data: { session } }) => {
				setSession(session);
				setUser(session?.user ?? null);
			})
			.catch(() => {
				setSession(null);
				setUser(null);
			})
			.finally(() => setLoading(false));

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
			setUser(session?.user ?? null);
			setLoading(false);
		});

		return () => subscription.unsubscribe();
	}, []);

	useEffect(() => {
		let active = true;
		fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
			headers: { apikey: import.meta.env.VITE_SUPABASE_KEY },
		})
			.then((response) => {
				if (!response.ok) throw new Error("Auth settings unavailable");
				return response.json() as Promise<{ external?: { google?: boolean } }>;
			})
			.then((settings) => {
				if (active) setGoogleAuthEnabled(settings.external?.google === true);
			})
			.catch(() => {
				if (active) setGoogleAuthEnabled(false);
			});
		return () => {
			active = false;
		};
	}, []);

	const signIn = async (email: string, password: string) => {
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (error) throw error;
	};

	const signUp = async (
		email: string,
		password: string,
		displayName?: string,
	) => {
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { full_name: displayName } },
		});
		if (error) throw error;
		return !!data.session;
	};

	const signOut = async () => {
		const { error } = await supabase.auth.signOut();
		if (error) throw error;
	};

	const signInWithGoogle = async () => {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: "google",
			options: { redirectTo: window.location.origin },
		});
		if (error) throw error;
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				session,
				loading,
				googleAuthEnabled,
				signIn,
				signUp,
				signOut,
				signInWithGoogle,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}
