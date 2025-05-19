"use client";

import { Platform, type Project } from "../../../project";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { IgnoreButton } from "./ignore-button";
import { useOptimistic, useState } from "react";

export function Projects({
	projects: initialProjects,
}: { projects: Project[] }) {
	const [projects, setProjects] = useState(initialProjects);
	const [optimisticProjects, setOptimisticProjects] =
		useOptimistic<Project[]>(projects);

	function handleIgnoreStart(projectId: string, platform: Platform) {
		setOptimisticProjects([
			...optimisticProjects.filter(
				(p) => p.projectId !== projectId && p.platform === platform,
			),
		]);
	}

	function handleIgnoreFinish(projectId: string, platform: Platform) {
		setProjects([
			...projects.filter(
				(p) => p.projectId !== projectId && p.platform === platform,
			),
		]);
	}

	return (
		<Table>
			<TableCaption>A list of your recent invoices.</TableCaption>
			<TableHeader>
				<TableRow>
					<TableHead className="">プラットフォーム</TableHead>
					<TableHead className="">タイトル</TableHead>
					<TableHead className="text-right">無視</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{optimisticProjects.map((project, index) => {
					const url =
						project.platform === Platform.Coconala
							? `https://coconala.com/requests/${project.projectId}`
							: `https://crowdworks.jp/public/jobs/${project.projectId}`;
					return (
						<TableRow key={project.projectId}>
							{project.hidden ? (
								<>
									<TableCell>
										<Link href={url} target="_blank" className="underline">
											{project.platform === Platform.Coconala
												? "coconala"
												: "クラウドワークス"}
										</Link>
									</TableCell>
									<TableCell>非公開</TableCell>
									<TableCell>-</TableCell>
									<TableCell>-</TableCell>
									<TableCell>-</TableCell>
									<TableCell>-</TableCell>
								</>
							) : (
								<>
									<TableCell>
										<Link href={url} target="_blank" className="underline">
											{project.platform === Platform.Coconala
												? "coconala"
												: "クラウドワークス"}
										</Link>
									</TableCell>
									<TableCell>
										<Link
											href={`/projects/platforms/${project.platform}/${project.projectId}`}
											className="underline"
										>
											{project.title}
										</Link>
									</TableCell>
									<TableCell>
										<IgnoreButton
											onIgnoreStart={() =>
												handleIgnoreStart(project.projectId, project.platform)
											}
											onIgnoreFinish={() =>
												handleIgnoreFinish(project.projectId, project.platform)
											}
											platform={project.platform}
											projectId={project.projectId}
										/>
									</TableCell>
								</>
							)}
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}
