import React from "react";
import AutoSizer from "react-virtualized-auto-sizer";

const ArvdoulAutoSizer = ({
  children,
  className = "",
  style = {},
}) => {
  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        ...style,
      }}
    >
      <AutoSizer>
        {({ width, height }) =>
          width > 0 &&
          height > 0 &&
          children({ width, height })
        }
      </AutoSizer>
    </div>
  );
};

export default React.memo(ArvdoulAutoSizer);
