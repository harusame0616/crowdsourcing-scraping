"use client";
import { Button } from "@/components/ui/button";
import type { Platform } from "../../../project";
import { ignoreProjectAction } from "./@modal/actions/ignore-project";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LoaderIcon } from "lucide-react";

export function IgnoreButton({
	platform,
	projectId,
}: { platform: Platform; projectId: string }) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	async function handleClick() {
		startTransition(async () => {
			await ignoreProjectAction({ projectId, platform });
			router.refresh();
		});
	}

	return (
		<Button
			type="button"
			onClick={handleClick}
			disabled={isPending}
			className="w-16"
		>
			{isPending ? <LoaderIcon className="animate-spin" /> : "無視"}
		</Button>
	);
}
