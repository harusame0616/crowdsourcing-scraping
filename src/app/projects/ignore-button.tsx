import { Button } from "@/components/ui/button";
import type { Platform } from "../../../project";
import { ignoreProjectAction } from "./@modal/actions/ignore-project";
import { startTransition } from "react";

export function IgnoreButton({
	platform,
	projectId,
	onIgnoreStart,
	onIgnoreFinish,
}: {
	platform: Platform;
	projectId: string;
	onIgnoreStart: () => void;
	onIgnoreFinish: () => void;
}) {
	function handleClick() {
		startTransition(async () => {
			onIgnoreStart();
			await ignoreProjectAction({ projectId, platform });
			onIgnoreFinish();
		});
	}

	return (
		<Button type="button" onClick={handleClick} className="w-16">
			無視
		</Button>
	);
}
