// src/components/UI/SkeletonLoaders.jsx
// Lightweight, non-intrusive loaders adhering strictly to the TopAppLoadingBanner design.
// Zero screen-covering skeletons, zero layout interference.
import React from "react";
import { TopAppLoadingBanner } from "../Navigation/RouteProgressBar.jsx";

export function Shimmer({ className = "" }) {
  return null;
}

export function StoriesSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Loading stories..." />;
}

export function PostSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Loading posts..." />;
}

export function HomeScreenSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Loading feed..." />;
}

export function FeedSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Loading feed..." />;
}

export function CreatePostSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Preparing creator studio..." />;
}

export function ProfileSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Loading profile..." />;
}

export function ChatSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Loading chats..." />;
}

export function VideosScreenSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Loading sparks..." />;
}

export function PostScreenSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} label="Loading post..." />;
}

export function GenericScreenSkeleton() {
  return <TopAppLoadingBanner isAnimating={true} />;
}

export function RouteFallback() {
  return <TopAppLoadingBanner isAnimating={true} />;
}

export default {
  Shimmer,
  StoriesSkeleton,
  PostSkeleton,
  HomeScreenSkeleton,
  FeedSkeleton,
  CreatePostSkeleton,
  ProfileSkeleton,
  ChatSkeleton,
  VideosScreenSkeleton,
  PostScreenSkeleton,
  GenericScreenSkeleton,
  RouteFallback,
};
