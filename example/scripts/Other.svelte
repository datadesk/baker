<script lang="typescript">
  import Inner from './Inner.svelte';

  export let name: string;
</script>

<h1>Hello, {name}!</h1>
<Inner {name} />

<style>
  h1 {
    color: purple;
  }
</style>
