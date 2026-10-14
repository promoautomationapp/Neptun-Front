import {useEffect,useState}from 'react';
import {searchCatalog}from './products.api';
import type {ProductFilters}from './products.api';
import type {Product}from '../../domain/models';
export function useCatalogSearch(filters:ProductFilters,enabled=true){
 const [products,setProducts]=useState<Product[]>([]);const[total,setTotal]=useState(0);const[error,setError]=useState('');const[loading,setLoading]=useState(false);const key=JSON.stringify(filters);
 useEffect(()=>{if(!enabled)return;const controller=new AbortController();const timer=setTimeout(()=>{setLoading(true);searchCatalog(JSON.parse(key)as ProductFilters,controller.signal).then(page=>{setProducts(page.products);setTotal(page.total);setError('');}).catch((cause:unknown)=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Could not search products.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});},180);return()=>{clearTimeout(timer);controller.abort();};},[key,enabled]);return {products,total,error,loading};
}
