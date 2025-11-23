<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { InstancedMesh, Object3D, Vector3 } from 'three';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { recordingStore } from '$lib/stores/recording.svelte';

	const COUNT = 50;
	const tempObj = new Object3D();

	// Particle state
	// Each particle needs: position, velocity, life, active
	type Particle = {
		position: Vector3;
		velocity: Vector3;
		life: number; // 0-1
		active: boolean;
	};

	const particles: Particle[] = Array(COUNT)
		.fill(0)
		.map(() => ({
			position: new Vector3(),
			velocity: new Vector3(),
			life: 0,
			active: false
		}));

	let meshRef = $state<InstancedMesh | null>(null);

	useTask((delta) => {
		if (!meshRef) return;

		const micLevel = analysisStore.micLevel;
		const isForceMode = uiStore.workspace === 'force';
		const interactionPoint = sculptureStore.interactionPoint;
		const interactionNormal = sculptureStore.interactionNormal;
		const _isRecording = recordingStore.state === 'recording'; // Only emit when actually applying force? Or just hovering?
		// Directive says "Emit particles when micLevel > threshold AND toolMode === 'force'"
		// Let's emit when there's interaction + sound

		const shouldEmit = isForceMode && interactionPoint && micLevel > 0.05;
		const isSubtractive = uiStore.sculptMode === 'subtractive';

		// Emission Logic
		if (shouldEmit) {
			// Find inactive particles to spawn
			// Emit rate depends on mic level
			const spawnCount = Math.ceil(micLevel * 2);
			let spawned = 0;

			for (let i = 0; i < COUNT; i++) {
				if (spawned >= spawnCount) break;

				if (!particles[i].active) {
					particles[i].active = true;
					particles[i].life = 1.0;

					// Spawn at interaction point with slight jitter
					particles[i].position
						.copy(interactionPoint!)
						.add(
							new Vector3(
								(Math.random() - 0.5) * 0.1,
								(Math.random() - 0.5) * 0.1,
								(Math.random() - 0.5) * 0.1
							)
						);

					// Velocity
					const normal = interactionNormal || new Vector3(0, 1, 0);
					const randomDir = new Vector3(
						Math.random() - 0.5,
						Math.random() - 0.5,
						Math.random() - 0.5
					).normalize();

					if (isSubtractive) {
						// Debris: Fly OUT along normal + random spread
						particles[i].velocity
							.copy(normal)
							.add(randomDir.multiplyScalar(0.5))
							.normalize()
							.multiplyScalar(2 + Math.random());
					} else {
						// Energy: Fly IN towards center?
						// Actually, for "Gathering", maybe spawn further out and fly IN?
						// Simpler: Spawn at point, fly randomly but swirl?
						// Let's stick to directive: "Particles fly in".
						// Spawn at Radius (0.5) and fly to center
						const radius = 0.5;
						particles[i].position.copy(interactionPoint!).add(randomDir.multiplyScalar(radius));
						particles[i].velocity
							.copy(particles[i].position)
							.sub(interactionPoint!)
							.normalize()
							.negate()
							.multiplyScalar(2 + Math.random());
					}

					spawned++;
				}
			}
		}

		// Update Loop
		let activeCount = 0;
		for (let i = 0; i < COUNT; i++) {
			const p = particles[i];
			if (p.active) {
				// Move
				p.position.addScaledVector(p.velocity, delta);

				// Age
				p.life -= delta * 2.0; // 0.5s lifetime

				if (p.life <= 0) {
					p.active = false;
					p.position.set(0, -1000, 0); // Hide
				} else {
					activeCount++;
					// Update Instance Matrix
					tempObj.position.copy(p.position);
					const scale = p.life * 0.05; // Shrink as they die
					tempObj.scale.set(scale, scale, scale);
					tempObj.updateMatrix();
					meshRef.setMatrixAt(i, tempObj.matrix);
				}
			} else {
				// Ensure hidden
				tempObj.position.set(0, -1000, 0);
				tempObj.updateMatrix();
				meshRef.setMatrixAt(i, tempObj.matrix);
			}
		}

		if (activeCount > 0 || shouldEmit) {
			meshRef.instanceMatrix.needsUpdate = true;
		}
	});

	let particleColor = $derived(uiStore.sculptMode === 'subtractive' ? '#ff8800' : '#00ffff');
</script>

{#if uiStore.workspace === 'force'}
	<T.InstancedMesh bind:ref={meshRef} args={[undefined, undefined, COUNT]} frustumCulled={false}>
		<T.IcosahedronGeometry args={[1, 0]} />
		<!-- Low poly particles -->
		<T.MeshBasicMaterial color={particleColor} transparent opacity={0.8} />
	</T.InstancedMesh>
{/if}
