import React from "react";

const TableHeader = ({ headers }) => {
    return (
        <thead className="sticky top-0 bg-white z-10">
            <tr>
                <th className="px-4 py-2 bg-white sticky left-0 z-10"></th>

            </tr>
        </thead>
    );
};

const TableBody = ({ floors }) => {
    return (
        <tbody>
            {floors.map(({ floor, units }, index) => (
                <tr key={index}>
                    <td className="text-center text-gray-500 bg-white sticky left-0 z-10">Floor {floor}</td>
                    {units.map((unit, unitIndex) => (
                        <td key={unitIndex} className="text-center border border-[#3D9D9B]">
                            {unit}
                        </td>
                    ))}
                </tr>
            ))}
        </tbody>
    );
};

const DynamicTowerTable = ({
    num_floors,
    num_units,
    unit_naming_type,
    add_tower_number_to_unit_name,
    tower_number,
    floorEdits = [],
}) => {
    const generateHeaders = (maxUnits) => {
        return Array.from({ length: maxUnits }, (_, i) =>
            unit_naming_type === "Alphabetical"
                ? `Unit ${String.fromCharCode(65 + i)}`
                : `Unit ${String(i + 1).padStart(2, "0")}`
        );
    };

    const generateFloors = () => {
        let maxUnits = num_units;
        let floorsData = Array.from({ length: num_floors }, (_, index) => {
            const floorNumber = num_floors - index;

            let unitCount = num_units;

            const floorOverride = floorEdits.find((edit) => Number(edit.floor) === floorNumber);
            if (floorOverride) {
                unitCount = Number(floorOverride.units);
            }

            maxUnits = Math.max(maxUnits, unitCount);

            const units = Array.from({ length: unitCount }, (_, unitIndex) => {
                let unitLabel = unit_naming_type === "Alphabetical"
                    ? String.fromCharCode(65 + unitIndex)
                    : `${(unitIndex + 1).toString().padStart(2, "0")}`;

                return add_tower_number_to_unit_name
                    ? `${tower_number}-${floorNumber}${unitLabel}`
                    : `${floorNumber}${unitLabel}`;
            });

            return { floor: floorNumber, units };
        });

        return { floorsData, maxUnits };
    };

    const { floorsData, maxUnits } = generateFloors();

    return (
        <div className="w-full mt-10 overflow-x-auto overflow-y-auto max-h-[500px]">
            <table className="w-full text-sm border-collapse">
                <TableHeader headers={generateHeaders(maxUnits)} />
                <TableBody floors={floorsData} />
            </table>
        </div>
    );
};

export default DynamicTowerTable;
