"use client";

import React, { useEffect, useState } from "react";
import { BentoCard } from "@/components/inventory/BentoCard";
import { FilterBar } from "@/components/inventory/FilterBar";
import { CategoryTabs } from "@/components/inventory/CategoryTabs";
import styles from "@/components/inventory/inventory.module.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

interface Product {
  id: string;
  title: string;
  featuredImage?: { url: string };
  price: number;
  sku: string;
  stock: number;
  tags: string[];
  metafields: {
    colour?: string;
    fabric?: string;
    region?: string;
    [key: string]: any;
  };
}

interface FilterValues {
  priceMin?: number;
  priceMax?: number;
  colour?: string;
  fabric?: string;
  region?: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>("All Sarees");
  const [filters, setFilters] = useState<FilterValues>({});
  const [displayed, setDisplayed] = useState<Product[]>([]);

  // Load products + collections once on mount
  useEffect(() => {
    async function load() {
      try {
        const prodRes = await fetch("/api/inventory");
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);

        // Load collection titles
        const collRes = await fetch("/api/collections");
        const collData = await collRes.json();
        const collTitles = collData.collections || [];
        const uniqueCollTitles = Array.from(new Set(collTitles.filter((c: string) => c !== "All Sarees")));
        setCollections(["All Sarees", ...uniqueCollTitles as string[]]);
      } catch (e) {
        console.error("Failed to load inventory", e);
      }
    }
    load();
  }, []);

  // Apply collection & filter logic
  useEffect(() => {
    let filtered = products;
    if (selectedCollection && selectedCollection !== "All Sarees") {
      filtered = filtered.filter(p => p.tags.includes(selectedCollection));
    }
    if (filters.priceMin !== undefined) filtered = filtered.filter(p => p.price >= filters.priceMin!);
    if (filters.priceMax !== undefined) filtered = filtered.filter(p => p.price <= filters.priceMax!);
    if (filters.colour) filtered = filtered.filter(p => p.metafields?.colour === filters.colour);
    if (filters.fabric) filtered = filtered.filter(p => p.metafields?.fabric === filters.fabric);
    if (filters.region) filtered = filtered.filter(p => p.metafields?.region === filters.region);
    setDisplayed(filtered);
  }, [products, selectedCollection, filters]);

  // Derive dropdown options from product metafields
  const colours = Array.from(new Set(products.map(p => p.metafields?.colour).filter((v): v is string => Boolean(v))));
  const fabrics = Array.from(new Set(products.map(p => p.metafields?.fabric).filter((v): v is string => Boolean(v))));
  const regions = Array.from(new Set(products.map(p => p.metafields?.region).filter((v): v is string => Boolean(v))));

  return (
    <div className="flex min-h-screen bg-[#FAF8F5]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Saree Inventory Grid" />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-[1360px] mx-auto w-full">
          <section className={styles.inventoryPage} style={{ background: 'transparent', padding: 0 }}>
            <CategoryTabs collections={collections} selected={selectedCollection} onSelect={setSelectedCollection} />
            <FilterBar onChange={setFilters} availableColours={colours} availableFabrics={fabrics} availableRegions={regions} />
            <div className={styles.grid} role="list">
              {displayed.map(p => (
                <BentoCard
                  key={p.id}
                  product={p}
                  onDelete={async (id) => {
                    await fetch(`/api/products?id=${id}&sku=${p.sku}`, { method: "DELETE" });
                    setProducts(prev => prev.filter(prod => prod.id !== id));
                  }}
                />
              ))}
              {displayed.length === 0 && <p className={styles.empty}>No products match the current filters.</p>}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
