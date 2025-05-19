import prisma from "@/lib/prisma";
import { Platform } from "../../../../../../../project";
import { Platform as PlatformPrisma } from "@/generated/prisma";

import { Modal } from "./modal";

export default async function NextPage({
	params,
}: { params: { id: string; platform: string } }) {
	const project = await prisma.project.findUnique({
		include: {
			hidden: true,
			visible: {
				include: {
					fixedWage: true,
					timeWage: true,
				},
			},
		},
		where: {
			projectId_platform: {
				projectId: params.id,
				platform:
					params.platform === Platform.Coconala
						? PlatformPrisma.Coconala
						: PlatformPrisma.CrowdWorks,
			},
		},
	});

	if (!project) {
		return <div>プロジェクトが見つかりません</div>;
	}

	if (project.hidden) {
		return <Modal title="非公開求人" />;
	}

	if (project.visible?.fixedWage) {
		return (
			<Modal title={project.visible.title}>
				<div
					// biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
					dangerouslySetInnerHTML={{
						__html: project.visible.description,
					}}
				/>
			</Modal>
		);
	}

	if (project.visible?.timeWage) {
		return (
			<Modal title={project.visible.title}>
				<div
					// biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
					dangerouslySetInnerHTML={{
						__html: project.visible.description,
					}}
				/>
			</Modal>
		);
	}

	throw new Error("プロジェクトが見つかりません");
}
