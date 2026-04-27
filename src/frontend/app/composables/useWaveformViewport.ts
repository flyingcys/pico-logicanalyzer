import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { WaveformRenderer } from '../../core/engines/WaveformRenderer';

export function useWaveformViewport() {
  const containerRef = ref<HTMLElement | null>(null);
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  const renderer = shallowRef<WaveformRenderer | null>(null);

  let resizeObserver: ResizeObserver | null = null;

  const resize = () => {
    renderer.value?.resize();
  };

  onMounted(() => {
    const canvas = canvasRef.value;
    if (!canvas) {
      return;
    }

    renderer.value = new WaveformRenderer(canvas);
    resize();

    if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
      resizeObserver = new ResizeObserver(() => {
        resize();
      });
      resizeObserver.observe(containerRef.value);
    }

    window.addEventListener('resize', resize);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', resize);
    resizeObserver?.disconnect();
    resizeObserver = null;

    renderer.value?.dispose();
    renderer.value = null;
  });

  return {
    containerRef,
    canvasRef,
    renderer,
    resize
  };
}
