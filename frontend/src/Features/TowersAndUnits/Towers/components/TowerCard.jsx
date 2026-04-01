import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { FaTrash } from 'react-icons/fa6';
import { FaArrowRight } from 'react-icons/fa6';
import TowerFloorTable from './TowerFloorTable';

const TowerCard = memo(({ tower, onDeleteClick, onTowerNameClick }) => {
  return (
    <div className="box-border flex flex-col w-full h-auto max-h-[600px] border border-borderNeutral rounded-[8px] shadow-sm hover:shadow-md transition-shadow bg-white">
      {/* Tower Label */}
      <div className="flex flex-row items-center justify-between py-2 md:py-[12px] px-3 md:px-6 min-h-[3.5rem] md:h-16 bg-gradient-to-r from-[rgba(60,157,155,0.15)] to-[rgba(60,157,155,0.1)] rounded-t-[8px] flex-none border-b-2 border-primary/20">
        <button
          onClick={() => onTowerNameClick && onTowerNameClick(tower.id)}
          className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 pr-2 text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg transition-all duration-300 hover:bg-primary/10 hover:shadow-sm px-2 md:px-4 py-1.5 md:py-2 -ml-2 md:-ml-4 group cursor-pointer"
          title="Click to view tower overview"
        >
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-base md:text-[20px] font-bold truncate text-gray-900 group-hover:text-primary transition-colors duration-300 leading-tight">
              {tower.tower_name} (Tower {tower.tower_number})
            </span>
            <span className="text-[10px] md:text-xs text-primary/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-medium mt-0.5">
              Click to view overview
            </span>
          </div>
          <FaArrowRight className="text-primary w-3 h-3 md:w-4 md:h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
        </button>
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <button
            className="p-1.5 md:p-2 hover:bg-white/50 rounded transition-colors"
            title="Edit Tower"
          >
            <Link to={`/EditTower/${tower.id}`}>
              <img src="./edit-03.png" alt="Edit" className="w-4 h-4 md:w-5 md:h-5" />
            </Link>
          </button>
          <button
            onClick={() => onDeleteClick(tower.id)}
            className="p-1.5 md:p-2 hover:bg-white/50 rounded transition-colors"
            title="Delete Tower"
          >
            <FaTrash className="text-error cursor-pointer text-base md:text-lg" />
          </button>
        </div>
      </div>

      {/* Tower Container */}
      <div className="flex flex-col py-3 px-3 md:py-4 md:px-4 gap-2 overflow-auto flex-1 min-h-0">
        <div className="overflow-auto rounded-[8px] min-w-full">
          <TowerFloorTable
            floors={tower.floors}
            unitNamingType={tower.unit_naming_type}
            addTowerNumberToUnitName={tower.add_tower_number_to_unit_name}
            towerNumber={tower.tower_number}
          />
        </div>
      </div>
    </div>
  );
});

TowerCard.displayName = 'TowerCard';

export default TowerCard; 