"use client";
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
		<Dialog
			open={true}
			defaultOpen={true}
			onOpenChange={() => {
				router.back();
			}}
		>
			<DialogContent className="max-w-[90vw]!">
				<DialogHeader>
					<DialogTitle>案件詳細</DialogTitle>
					<DialogDescription />
				</DialogHeader>
				<div className="overflow-y-auto max-h-[70vh]">{children}</div>
			</DialogContent>
		</Dialog>
	);
}
