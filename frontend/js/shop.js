// shop.js
document.addEventListener('DOMContentLoaded', () => {
    const productGrid = document.getElementById('product-grid');
    const productCount = document.getElementById('product-count');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const sortDropdown = document.getElementById('sort-dropdown');
    const paginationControls = document.getElementById('pagination-controls');

    let currentPage = 1;
    const limit = 12;

    function renderSkeletons() {
        productGrid.innerHTML = '';
        for (let i=0; i<6; i++) {
            productGrid.innerHTML += `
                <div class="bg-surface rounded-xl overflow-hidden">
                    <div class="h-[350px] skeleton"></div>
                    <div class="p-4">
                        <div class="h-4 skeleton w-3/4 mb-2"></div>
                        <div class="h-4 skeleton w-1/4"></div>
                    </div>
                </div>
            `;
        }
    }

    async function fetchProducts() {
        renderSkeletons();
        
        const category = document.querySelector('input[name="category"]:checked').value;
        const gender = document.querySelector('input[name="gender"]:checked').value;
        const sort = sortDropdown.value;

        let queryParams = new URLSearchParams({
            page: currentPage,
            limit: limit,
            sort: sort
        });

        if (category !== 'All') queryParams.append('category', category);
        if (gender !== 'All') queryParams.append('gender', gender);

        try {
            const res = await api.get(`/products?${queryParams.toString()}`);
            renderProducts(res.data);
            productCount.textContent = `Showing ${res.data.length} of ${res.pagination.total} products`;
            renderPagination(res.pagination.pages);
        } catch (e) {
            console.error(e);
            productGrid.innerHTML = '<div class="col-span-full text-center text-red-500 py-10">Failed to load products</div>';
        }
    }

    function renderProducts(products) {
        productGrid.innerHTML = '';
        if (products.length === 0) {
            productGrid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10">No products found matching your criteria.</div>';
            return;
        }

        products.forEach(product => {
            productGrid.innerHTML += `
                <div class="group relative">
                    <a href="product.html?id=${product._id}" class="block relative bg-secondary overflow-hidden h-[400px]">
                        <img src="${product.images[0]}" alt="${product.name}" class="w-full h-full object-cover object-top mix-blend-multiply smooth-transition group-hover:scale-105">
                        <button onclick="event.preventDefault(); window.location.href='tryOn.html?productId=${product._id}'" class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-accent hover:bg-accent-hover text-white px-8 py-3 text-xs uppercase tracking-widest font-semibold opacity-0 group-hover:opacity-100 smooth-transition translate-y-4 group-hover:translate-y-0">
                            Try On
                        </button>
                    </a>
                    <div class="pt-4 flex justify-between items-start">
                        <div>
                            <h3 class="text-primary font-semibold text-sm uppercase tracking-wide mb-1 pr-8"><a href="product.html?id=${product._id}">${product.name}</a></h3>
                            <div class="text-muted text-xs uppercase">${product.category}</div>
                        </div>
                        <div class="text-primary font-bold text-sm">₹${product.price}</div>
                        <button onclick="addToFavorites('${product._id}')" class="absolute top-4 right-4 text-muted hover:text-accent">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                        </button>
                    </div>
                </div>
            `;
        });
    }

    function renderPagination(totalPages) {
        paginationControls.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `w-10 h-10 rounded-lg flex items-center justify-center border border-gray-700 ${i === currentPage ? 'bg-accent text-white border-accent' : 'bg-surface text-gray-400 hover:text-white hover:border-gray-500'}`;
            btn.textContent = i;
            btn.onclick = () => {
                currentPage = i;
                fetchProducts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
            paginationControls.appendChild(btn);
        }
    }

    applyFiltersBtn.addEventListener('click', () => {
        currentPage = 1;
        fetchProducts();
    });

    sortDropdown.addEventListener('change', () => {
        currentPage = 1;
        fetchProducts();
    });

    window.addToFavorites = async (productId) => {
        try {
            await api.post('/favorites/add', { productId });
            window.showToast('Added to wishlist', 'success');
        } catch(e) {
            window.showToast('Please login first', 'info');
        }
    };

    // Initial fetch
    fetchProducts();
});
