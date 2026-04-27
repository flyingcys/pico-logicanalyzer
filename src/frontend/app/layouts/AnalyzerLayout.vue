<template>
  <div class="analyzer-layout">
    <header class="analyzer-layout__header">
      <slot name="header" />
    </header>

    <div class="analyzer-layout__body">
      <aside class="analyzer-layout__sidebar analyzer-layout__sidebar--left">
        <slot name="left" />
      </aside>

      <main class="analyzer-layout__main">
        <slot />
      </main>

      <aside class="analyzer-layout__sidebar analyzer-layout__sidebar--right">
        <slot name="right" />
      </aside>
    </div>

    <footer class="analyzer-layout__footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<style scoped>
.analyzer-layout {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
}

.analyzer-layout__header,
.analyzer-layout__footer {
  min-width: 0;
}

.analyzer-layout__body {
  display: grid;
  grid-template-columns: minmax(280px, 320px) minmax(0, 1fr) minmax(320px, 380px);
  min-height: 0;
}

.analyzer-layout__sidebar,
.analyzer-layout__main {
  min-width: 0;
  min-height: 0;
}

.analyzer-layout__sidebar {
  overflow: auto;
  background: #111827;
}

.analyzer-layout__sidebar--left {
  border-right: 1px solid rgba(148, 163, 184, 0.14);
}

.analyzer-layout__sidebar--right {
  border-left: 1px solid rgba(148, 163, 184, 0.14);
}

.analyzer-layout__main {
  overflow: auto;
  background: #020617;
}

@media (max-width: 1200px) {
  .analyzer-layout__body {
    grid-template-columns: minmax(240px, 280px) minmax(0, 1fr) minmax(280px, 340px);
  }
}

@media (max-width: 960px) {
  .analyzer-layout__body {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(320px, 1fr) auto;
  }

  .analyzer-layout__sidebar--left,
  .analyzer-layout__sidebar--right {
    border: 0;
    border-top: 1px solid rgba(148, 163, 184, 0.14);
  }
}
</style>
