-- Add this JOIN section before the "WHERE" clause in the unpaid periods query
-- This replaces the existing SELECT lines around 3817-3820 and adds the JOIN before line 3910

-- New SELECT column to add (replace line 3820):
                    COALESCE(payment_agg.payment_details, JSON_ARRAY()) AS payment_details,
                    COALESCE(bill_cat_agg.category_details, JSON_ARRAY()) AS bill_category_details,
                    COALESCE(waiver_agg.waiver_details, JSON_ARRAY()) AS waiver_data,
                    COALESCE(item_agg.item_details, JSON_ARRAY()) AS service_fee_items

-- New JOIN to add (before line 3902, after bill_cat_agg LEFT JOIN):
                /* Pre-aggregated service fee items */
                LEFT JOIN (
                    SELECT 
                        sfi.service_fee_payment_id,
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', sfi.id,
                                'item_type', sfi.item_type,
                                'amount', CAST(sfi.amount AS CHAR),
                                'description', sfi.description,
                                'bill_category_id', sfi.bill_category_id,
                                'bill_category_name', COALESCE(bc_item.name, 'N/A')
                            )
                        ) as item_details
                    FROM service_fee_management_servicefeeitem sfi
                    LEFT JOIN bill_category bc_item ON sfi.bill_category_id = bc_item.id
                    GROUP BY sfi.service_fee_payment_id
                ) item_agg ON item_agg.service_fee_payment_id = sfp.id
