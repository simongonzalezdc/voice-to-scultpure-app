import { get, set, del, keys } from 'idb-keyval';
import type { SculptureDefinition, ProjectMetadata } from '$lib/types';

const OPFS_ROOT = '/voice-to-sculpture';
const PROJECTS_DIR = `${OPFS_ROOT}/projects`;
const METADATA_KEY_PREFIX = 'project-metadata-';

async function ensureDirectory(path: string): Promise<FileSystemDirectoryHandle> {
	if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
		throw new Error('OPFS not supported');
	}

	const root = await navigator.storage.getDirectory();
	const parts = path.split('/').filter((p) => p);
	let current = root;

	for (const part of parts) {
		current = await current.getDirectoryHandle(part, { create: true });
	}

	return current;
}

async function getProjectsDirectory(): Promise<FileSystemDirectoryHandle> {
	return ensureDirectory(PROJECTS_DIR);
}

export async function saveProject(
	sculpture: SculptureDefinition,
	audioBlob?: Blob
): Promise<string> {
	const dir = await getProjectsDirectory();
	const projectId = sculpture.id || crypto.randomUUID();
	const projectDir = await dir.getDirectoryHandle(projectId, { create: true });

	// Save sculpture JSON
	const sculptureFile = await projectDir.getFileHandle('sculpture.json', { create: true });
	const writable = await sculptureFile.createWritable();
	await writable.write(JSON.stringify(sculpture, null, 2));
	await writable.close();

	// Save audio if provided
	if (audioBlob) {
		const audioFile = await projectDir.getFileHandle('audio.wav', { create: true });
		const audioWritable = await audioFile.createWritable();
		await audioWritable.write(audioBlob);
		await audioWritable.close();
	}

	// Save metadata to IndexedDB
	const metadata: ProjectMetadata = {
		id: projectId,
		name: sculpture.name,
		createdAt: sculpture.createdAt,
		sculptureId: sculpture.id
	};

	await set(`${METADATA_KEY_PREFIX}${projectId}`, metadata);

	return projectId;
}

export async function loadProject(id: string): Promise<{
	sculpture: SculptureDefinition;
	audioBlob?: Blob;
}> {
	const dir = await getProjectsDirectory();
	const projectDir = await dir.getDirectoryHandle(id);

	// Load sculpture JSON
	const sculptureFile = await projectDir.getFileHandle('sculpture.json');
	const sculptureData = await sculptureFile.getFile();
	const sculptureText = await sculptureData.text();
	const sculpture = JSON.parse(sculptureText) as SculptureDefinition;

	// Try to load audio
	let audioBlob: Blob | undefined;
	try {
		const audioFile = await projectDir.getFileHandle('audio.wav');
		const audioData = await audioFile.getFile();
		const arrayBuffer = await audioData.arrayBuffer();
		audioBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
	} catch {
		// Audio file doesn't exist, that's okay
	}

	return { sculpture, audioBlob };
}

export async function listProjects(): Promise<ProjectMetadata[]> {
	const allKeys = await keys();
	const metadataKeys = allKeys.filter((k) =>
		typeof k === 'string' && k.startsWith(METADATA_KEY_PREFIX)
	) as string[];

	const metadataList: ProjectMetadata[] = [];
	for (const key of metadataKeys) {
		const metadata = await get<ProjectMetadata>(key);
		if (metadata) {
			metadataList.push(metadata);
		}
	}

	return metadataList.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteProject(id: string): Promise<void> {
	const dir = await getProjectsDirectory();
	try {
		await dir.removeEntry(id, { recursive: true });
	} catch {
		// Directory might not exist
	}

	await del(`${METADATA_KEY_PREFIX}${id}`);
}

