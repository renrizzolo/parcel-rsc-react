# @renr/parcel-rsc-router

A client-side router designed for React Server Components (RSC) applications built with Parcel's `react-static` packager.

⚠️ This package is an alpha / work in progress.

## Features

- **Client-side navigation:** Navigate between pages using the `<Link>` component.
- **Type safety:** Type-safe route definitions via `@renr/parcel-reporter-rsc-router` (the Link's `to` prop is typed).
- **Programmatic navigation:** Control navigation programmatically using the `useRouter` hook.
- **Location access:** Access the current URL and its properties with the `useLocation` hook.
- **Route data access:** Retrieve data associated with the current route using the `useCurrentRoute` hook.
- **Automatic scroll restoration:** Remembers and restores scroll positions when navigating back and forth.
- **Hash scrolling:** Automatically scrolls to elements identified by URL hash.
- **RSC integration:** Navigations fetch the rsc payload for the target route and update the UI without a full page reload.

## Installation

For the initial Parcel static RSC site setup see https://parceljs.org/recipes/rsc/#static-rendering, or check out the example app [here](https://github.com/renrizzolo/parcel-rsc-react/tree/main/apps/my-static-site).

Install the package using your preferred package manager:

```bash
pnpm add @renr/parcel-rsc-router
# or
npm install @renr/parcel-rsc-router
# or
yarn add @renr/parcel-rsc-router
```

Install the required peer dependency:

```bash
pnpm add @renr/parcel-reporter-rsc-router
# or
npm install @renr/parcel-reporter-rsc-router
# or
yarn add @renr/parcel-reporter-rsc-router
```

## Usage

### 1. Wrapping your Application

Wrap your main application component with the `RouterProvider` and pass your routes. This component should be a client component.

```tsx
// src/appProvider.tsx (example)
"use client";
import { RouterProvider } from "@renr/parcel-rsc-router";
import { flatRoutes } from "./routes";

export function AppProvider({ children }: { children: React.ReactNode }) {
  return <RouterProvider routes={flatRoutes}>{children}</RouterProvider>;
}
```

### 2. Navigation

#### Declarative Navigation with `<Link>`

Use the `<Link>` component for client-side navigation. It behaves like a standard `<a>` tag but intercepts clicks to use the router's navigation logic.

```tsx
import { Link } from "@renr/parcel-rsc-router";

function NavigationMenu() {
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/about">About</Link>
      <Link to="/blog/first-post" className="nav-item">
        First Blog Post
      </Link>
      <Link to="/contact" hash="form-section">
        Contact (scroll to form)
      </Link>
      <Link to="/products" search={{ category: "electronics" }}>
        Electronics
      </Link>
    </nav>
  );
}
```

#### Programmatic Navigation with `useRouter`

For more complex navigation scenarios, use the `useRouter` hook to get access to the `navigate` function.

```tsx
import { useRouter } from "@renr/parcel-rsc-router";

function LoginForm() {
  const { navigate } = useRouter();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // ... form submission logic
    navigate("/dashboard"); // Navigate after successful login
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... form fields */}
      <button type="submit">Login</button>
    </form>
  );
}
```

### 4. Accessing Route Information

#### `useLocation()`

The `useLocation` hook provides access to the browser's `Location` object, giving you details about the current URL.

```tsx
import { useLocation } from "@renr/parcel-rsc-router";

function CurrentPathDisplay() {
  const location = useLocation();
  return (
    <div>
      <p>Current Pathname: {location.pathname}</p>
      <p>Current Search Params: {location.search}</p>
      <p>Current Hash: {location.hash}</p>
    </div>
  );
}
```

#### `useCurrentRoute()`

The `useCurrentRoute` hook returns the `RouteData` object for the currently matched route, allowing you to access any custom data associated with it.

```tsx
import { useCurrentRoute } from "@renr/parcel-rsc-router";

function PageTitle() {
  const currentRoute = useCurrentRoute();
  const title = currentRoute?.data?.title || "Page Not Found";

  return <h1>{title}</h1>;
}
```

## API Reference

### Components

#### `RouterProvider`

The main component that provides the routing context to your application.

```tsx
<RouterProvider routes={RouteData[]} children={React.ReactNode} />
```

- `routes`: An array of `RouteData` objects defining your application's routes.
- `children`: The React nodes to be rendered within the router's context.

#### `Link`

A component for declarative client-side navigation.

```tsx
<Link
  to={RoutePath}
  hash?: string
  search?: Record<string, string>
  children={React.ReactNode}
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  target?: HTMLAttributeAnchorTarget
  {...restProps: React.AnchorHTMLAttributes<HTMLAnchorElement>}
/>
```

- `to`: The target path for the link (e.g., `"/dashboard"`).
- `hash`: Optional hash segment for the URL (e.g., `"form-section"`).
- `search`: Optional object of query parameters (e.g., `{ category: "electronics" }`).
- `children`: The content to render inside the link.
- `onClick`: Optional click handler.
- `target`: Standard `target` attribute for `<a>` tags (e.g., `"_blank"`).
- `{...restProps}`: Any other standard HTML `<a>` tag attributes.

### Hooks

#### `useRouter()`

Returns an object with methods for programmatic navigation.

```typescript
const { navigate } = useRouter();
navigate(to: string); // Navigates to the specified path.
```

#### `useLocation()`

Returns the browser's `Location` object for the current URL.

```typescript
const location: Location = useLocation();
// location.pathname, location.search, location.hash, etc.
```

#### `useCurrentRoute()`

Returns the `RouteData` object for the currently matched route.

```typescript
const currentRoute: RouteData | undefined = useCurrentRoute();
// currentRoute?.path, currentRoute?.data, etc.
```
