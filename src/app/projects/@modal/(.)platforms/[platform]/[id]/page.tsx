import { ProjectDetail } from "@/app/projects/project-detail";
import { Modal } from "./modal";

export default function NextPage({
	params,
}: { params: { id: string; platform: string } }) {
	return (
		<Modal>
			<ProjectDetail projectId={params.id} platform={params.platform} />
		</Modal>
	);
}
