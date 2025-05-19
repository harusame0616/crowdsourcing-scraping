"use client";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

export function Modal({
	children,
}: {
	children: React.ReactNode;
}) {
	const router = useRouter();
	return (
		<Dialog open={true} defaultOpen={true}>
			<DialogContent className="max-w-[90vw]!">
				<DialogHeader>
					<DialogTitle>案件詳細</DialogTitle>
					<DialogDescription />
					<div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								router.back();
							}}
						>
							戻る
						</Button>
					</div>
				</DialogHeader>
				<div className="overflow-y-auto max-h-[70vh]">{children}</div>
			</DialogContent>
		</Dialog>
	);
}
