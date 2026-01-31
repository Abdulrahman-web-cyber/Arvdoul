import React from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

export default function TrendingWidget({ items }) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  if (!items || !items.length) {
    return <div className="text-sm text-muted-foreground">No trending topics yet.</div>;
  }

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm">Trending</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.slice(0, 12).map((topic) => (
          <button
            key={topic.id}
            onClick={`() => navigate(`/search?q=${encodeURIComponent(topic.tag || topic.name)}`)`}
            title={topic.tag || topic.name}
            aria-label={`Search for ${topic.tag || topic.name}`}
            className={`px-3 py-2 w-full rounded-lg text-xs font-medium truncate text-left
              ${theme === "dark" ? "bg-gray-800 text-white hover:bg-gray-700" : "bg-gray-100 text-gray-900 hover:bg-gray-200"}`}
          >
            #{topic.tag || topic.name}
            {topic.count !== undefined && (
              <span className="text-[10px] ml-1 text-muted-foreground">({topic.count})</span>
            )}
          </button>
        ))}
      </div>
      {items.length > 12 && (
        <button
          onClick={() => navigate("/trending")}
          className="mt-2 w-full text-xs text-primary-600 font-medium"
        >
          See All
        </button>
      )}
    </div>
  );
}

TrendingWidget.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      tag: PropTypes.string,
      name: PropTypes.string,
      count: PropTypes.number,
    })
  ),
};

TrendingWidget.defaultProps = {
  items: [],
};