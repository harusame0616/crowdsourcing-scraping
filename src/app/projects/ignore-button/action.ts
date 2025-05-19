"use server";
import prisma from "@/lib/prisma";
import { Platform as PrismaPlatform } from "@/generated/prisma";
import { Platform } from "../../../../project";

type IgnoreProjectActionParams = {
	projectId: string;
	platform: Platform;
};

export async function ignoreProjectAction({
	projectId,
	platform,
}: IgnoreProjectActionParams) {
	await prisma.projectIgnore.create({
		data: {
			projectId,
			platform:
				platform === Platform.Coconala
					? PrismaPlatform.Coconala
					: PrismaPlatform.CrowdWorks,
		},
	});
}
