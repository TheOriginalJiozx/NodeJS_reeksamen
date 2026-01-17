<script>
    import { route } from './lib/router.js';
    import { onMount } from 'svelte';
    import Toast from '../components/toast.svelte';
    import Navbar from '../components/navbar.svelte';
    import Booking from '../pages/booking.svelte';
    import Home from '../pages/Home.svelte';
    import Footer from '../components/footer.svelte';
    import Login from '../pages/login.svelte';
    import Register from '../pages/register.svelte';
    import Profile from '../pages/profile.svelte';
    import MyBookings from '../pages/myBookings.svelte';
    import MyResources from '../pages/myResources.svelte';

    let current;
    const unsubscribe = route.subscribe(route => current = route);

    const routes = {
        '/': Home,
        '/booking': Booking,
        '/login': Login,
        '/register': Register,
        '/profile': Profile,
        '/mybookings': MyBookings,
        '/myresources': MyResources
    };

    onMount(() => {
        return () => unsubscribe();
    });
</script>

<div class="min-h-screen flex flex-col">
    <header>
        <Navbar />
    </header>

    <main class="flex-1 container mx-auto p-4">
        {#if current}
            <svelte:component this={routes[current] ?? Home} />
        {:else}
            <Home />
        {/if}
    </main>

    <footer>
        <Footer />
    </footer>

    <Toast />
</div>
