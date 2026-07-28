import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home Page", () => {
  it("renders Next.js logo and main heading", () => {
    render(<Home />);
    const heading = screen.getByText(/To get started, edit the page.tsx file/i);
    expect(heading).toBeInTheDocument();
  });
});
