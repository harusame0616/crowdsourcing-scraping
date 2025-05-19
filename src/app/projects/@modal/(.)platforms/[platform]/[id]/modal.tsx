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
	title,
	description,
}: {
	children?: React.ReactNode;
	title: string;
	description?: string;
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
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="overflow-y-auto max-h-[70vh]">{children}</div>
			</DialogContent>
		</Dialog>
	);
}
